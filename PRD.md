# PRD — VentSmart Kingston (Arduino + Web App for Ventilation, Cost Savings, and Mold Risk)

## 1) Product Summary
**VentSmart Kingston** helps users decide whether to **open a window** or **use heating/AC** by combining:
- **Indoor sensor data** (temperature, humidity, pressure)
- **Outdoor weather data for Kingston** (temp/humidity + short forecast)
- **Ontario/Utilities Kingston electricity price plan data** (TOU / Tiered / ULO)

It outputs a **single clear recommendation** plus:
- **Estimated cost/savings** (rough but explainable)
- **Mold risk meter** based on humidity exposure over time
- A **“Why?”** explanation panel showing the reasoning

---

## 2) Problem Statement
Users waste money and increase mold risk because they:
- Run AC when outside air is cooler/drier and electricity is expensive
- Don’t realize humidity stayed high long enough to create mold risk
- Don’t know current electricity price periods (TOU/ULO) or how they affect decisions

---

## 3) Goals / Non-goals

### Goals (MVP)
1. Display **indoor vs outdoor** temperature/humidity clearly.
2. Provide a recommendation: **open window vs heat vs AC vs do nothing**.
3. Estimate **1-hour cost difference** between HVAC vs natural ventilation.
4. Track humidity over time and show **mold risk level** + timeline.
5. Provide a **“Why?”** button showing explainable reasons.

### Non-goals (MVP)
- Perfect building physics simulation (use a reasonable approximation).
- Full HVAC control (advisory only).
- Clinical mold diagnosis (risk indicator only).

---

## 4) Target Users
- **Students in Kingston (primary):** cost-sensitive, small rooms, wants quick advice.
- **Homeowners (secondary):** reduce energy use while staying comfortable.
- **Landlords/building managers (future):** prevent mold across multiple rooms/units.

---

## 5) Key User Journeys

### First-time user
1. Google sign-in
2. Enter **postal code**
3. Select electricity plan (**TOU / ULO / Tiered**) — default TOU
4. Pair device (enter device code / QR)
5. Dashboard shows live readings + recommendation

### Returning user
- Sees:
  - “You saved $X this month” + “$Y since you started”
  - Current recommendation + “Why?”
  - Mold risk bar + humidity timeline
  - Comfort preference controls (target temp band)

---

## 6) Data Sources

### Electricity pricing (Utilities Kingston / OEB plan tables)
Support:
- **TOU** rates and schedules
- **ULO** rates and schedules
- **Tiered** thresholds and rates

**Implementation note (MVP):**
- Hardcode tables for **Winter** and **Summer** seasons.
- Determine season via date:
  - Winter: Nov 1 – Apr 30
  - Summer: May 1 – Oct 31
- Apply weekday/weekend rules and time windows to compute **current rate**.

### Weather
Use a weather API to fetch:
- Current Kingston outdoor **temperature** and **humidity**
- Short-term forecast (next 3–6 hours)
- Optional: precipitation probability for “air out now; rain coming”

---

## 7) Hardware Requirements (MVP)

### Hardware
- **Arduino Uno R3**
- Sensors:
  - **Temperature + Humidity** (recommended combo sensor)
  - **Barometer / pressure sensor** (or included via combo sensor)
- Connectivity (Uno has no Wi-Fi):
  - **Option A (recommended):** Uno → USB → **Gateway app** on laptop/RPi
  - **Option B:** Uno + ESP8266/ESP-01 module (more complexity)

### Firmware responsibilities
- Sample sensors every **30–60 seconds**
- Emit message:
  - `{ timestamp, device_id, temp_C, humidity_RH, pressure_hPa }`
- Range validation and error flags
- Optional: ring-buffer last N readings if uplink is down

---

## 8) System Architecture (MVP)

### Flow
1. **Arduino** reads sensors
2. **Gateway** forwards readings to backend (HTTP/MQTT)
3. **Backend**:
   - Stores time-series readings
   - Fetches outdoor weather + forecast
   - Computes current electricity rate period & price
   - Runs recommendation + mold-risk model
   - Produces savings estimates + daily summaries
4. **Web App** displays dashboard + charts + explanations

---

## 9) Core Logic Requirements

### 9.1 Recommendation Engine
**Inputs**
- Indoor: `Tin`, `RHin`
- Outdoor: `Tout`, `RHout` (+ forecast)
- Electricity plan & current rate `price_cents_per_kWh`
- Comfort band: default `20–23°C` (editable)
- Optional user state: “I’m hot / I’m cold” (bias)

**Outputs**
- `state ∈ { OPEN_WINDOW, USE_AC, USE_HEAT, DO_NOTHING }`
- `confidence ∈ { LOW, MEDIUM, HIGH }`
- `reasons[]` list for “Why?”

**MVP decision rules (explainable)**
1. **Comfort check**
   - If `Tin` within comfort band AND mold risk not high → `DO_NOTHING`  
2. **Ventilation opportunity**
   - Recommend `OPEN_WINDOW` if:
     - Outdoor helps move toward comfort: `|Tout - target| < |Tin - target|`
     - Outdoor is not “wetter” than indoor (simple): `RHout < RHin`
     - Forecast doesn’t suggest immediate humidity spike/rain (heuristic)
3. **HVAC choice**
   - If too warm inside AND outdoor won’t help → `USE_AC`
   - If too cold inside AND outdoor won’t help → `USE_HEAT`
4. **Price sensitivity**
   - If currently expensive (TOU/ULO on-peak), bias toward `OPEN_WINDOW` when feasible.

**UI requirement**
- Always include “Why?” reasons:
  - “Outside is X°C cooler and Y% drier”
  - “Electricity is on-peak right now”
  - “Forecast shows rain soon”

---

### 9.2 Cost & Savings Model (simple, explainable)
**Goal:** estimate cost difference over next hour.

#### Room approximation (student room)
- Room: `4m × 3m × 2.5m → 30m³`
- Use a rule-of-thumb:
  - `kWh_per_degC = 0.1` (editable later)

#### Heating cost estimate
- `ΔT = |target_temp - Tin|`
- `kWh_room = kWh_per_degC * ΔT`
- `cost_heat_$ = kWh_room * (price_cents_per_kWh / 100)`

#### Cooling (AC) cost estimate
- Use AC efficiency (COP):
  - `COP_default = 3` (editable)
- `kWh_elec_ac = kWh_room / COP_default`
- `cost_ac_$ = kWh_elec_ac * (price_cents_per_kWh / 100)`

#### Ventilation cost
- Treat as ~$0 electricity (note: user comfort tradeoff remains)

#### Savings output
- `savings_$ = cost_hvac_$ - cost_window_$`

**UI requirement**
- “How we estimate” tooltip:
  - Uses `0.1 kWh per °C` and `COP ≈ 3` default
  - Editable settings later

---

### 9.3 Mold Risk Model (time-based)
**Inputs**
- Indoor humidity time series `RH(t)` at 1–5 minute resolution (MVP can be 60s)

**Daily features**
- `minutes_over_60`
- `minutes_60_70`
- `minutes_over_70`
- `max_consecutive_over_70`
- Optional: rolling-24h area above 60%

**MVP thresholds**
- **LOW:** `<60%` most of day OR short bursts
- **MEDIUM:** `60–70%` for more than `N` minutes (default: 60 min/day)
- **HIGH:** `>70%` for `>3 hours cumulative/day` OR `>90 min consecutive`

**Outputs**
- `risk_level ∈ { LOW, MEDIUM, HIGH }`
- `risk_score 0–100` (map thresholds to a score)
- Explanation string:
  - “Humidity has been >70% for 2.3 hours today…”

**UI requirement**
- Show:
  - Mold risk bar/gauge
  - 24h humidity timeline chart
  - “Why mold risk is high” explanation

---

## 10) Functional Requirements

### P0 — Must Have (MVP)
- Sensor ingest pipeline + timestamps
- Dashboard with indoor/outdoor temp + humidity
- Recommendation banner (big human phrase)
- “Why?” panel listing core reasons
- Mold risk bar + last 24h humidity chart
- Savings estimate for next hour + today

### P1 — Should Have
- Plan selection (TOU/ULO/Tiered)
- Short forecast hint (“air out now; rain coming”)
- Notifications (web push) for high mold risk / ventilation opportunity
- Overrides:
  - “Don’t recommend opening windows” (noise/pollen/smoke)
  - Quiet/sleep mode

### P2 — Nice to Have
- Multi-room / multi-device support
- Landlord dashboard
- Learning/calibration of `kWh_per_degC` per building

---

## 11) UX / UI Requirements

### Dashboard (Main)
- **Recommendation card**
  - Example:
    - “👉 Open your window for ~20 minutes to save money.”
    - “🔥 It’s cheaper to use heating now than leave the window open.”
  - Button: **Why?**
- **Indoor vs Outdoor**
  - Two clear columns:
    - Temp (°C)
    - Humidity (%RH)
- **Electricity price chip**
  - Example: “TOU: On-peak (20.3¢/kWh)”
- **Savings widget**
  - “Next hour: HVAC ≈ $X vs Window ≈ $0 → Save ≈ $Y”
- **Mold risk module**
  - Bar/gauge + explanation tooltip
  - 24h humidity timeline

### Savings Page
- Tabs: Today / Month / All-time
- Show:
  - `$ saved`
  - `kWh saved`
  - Assumptions card (room size, `kWh_per_degC`, COP)

### Setup Flow
- Google sign-in
- Postal code
- Electricity plan selection
- Device pairing (device ID / QR)

---

## 12) Backend Data Model (suggested)
- `users`:
  - `{ user_id, postal_code, plan_type, comfort_min, comfort_max, room_kwh_per_degC, ac_cop, created_at }`
- `devices`:
  - `{ device_id, user_id, location_name }`
- `readings` (time-series):
  - `{ device_id, ts, temp_C, RH, pressure_hPa, status_flags }`
- `daily_summary`:
  - `{ user_id, date, kWh_saved_est, $saved_est, minutes_over_60, minutes_over_70, risk_level }`
- `recommendations_log`:
  - `{ ts, user_id, state, confidence, reasons[], inputs_snapshot }`

---

## 13) Security & Privacy
- Google OAuth sign-in
- Store only necessary data (postal code, preferences, sensor readings)
- Provide “delete my data” flow
- Do not store exact address (postal code is enough)

---

## 14) Reliability & Performance
- If sensors fail: mark readings invalid and show “sensor offline”
- Weather API fallback to last value; label as stale when old
- Electricity rate tables cached locally; swap seasons automatically by date

---

## 15) Success Metrics
- Engagement: daily active users, “Why?” opens
- Outcomes: estimated `$ saved/user/week`, reduction in high-humidity minutes
- Reliability: % of time dashboard has fresh sensor + weather (<5 min old)

---

## 16) Risks & Mitigations
- **Uno connectivity** → use USB gateway for MVP.
- **Cost estimate inaccuracies** → transparent assumptions + editable parameters.
- **Humidity sensor drift** → calibration note + sanity checks.
- **Unsafe “open window” cases** → user override toggles + disclaimers.

---

## 17) Milestones (Suggested)
1. Sensor readout on Uno + serial output + validation
2. Gateway → backend ingest → database → indoor-only dashboard
3. Add weather + electricity pricing → recommendation banner
4. Add mold risk model + humidity timeline + savings + “Why?”
5. Polish, edge cases, demo script, presentation assets

---

## 18) Future Ideas (Pitch-friendly)
- Multi-room buildings + landlord preventative maintenance dashboard
- Learn each room’s real `kWh_per_degC` from observed heat/cool rates
- Add IAQ sensors (CO₂/VOC) to improve ventilation decisions