# 🐻 Goldilocks Kingston

**Smart home climate advisor for Kingston, Ontario** — Real-time IoT sensors + AI-powered recommendations to optimize comfort, save money, and reduce carbon emissions.

Built for QHacks 2026.

---

## 🌟 Features

### 🏠 Smart Climate Control
- **Real-time monitoring** with ESP32 + DHT11 sensor (temperature, humidity, pressure)
- **AI recommendations** powered by Google Gemini 2.0 — when to open windows, adjust thermostat, or use heating/cooling
- **Mold risk detection** with historical humidity analysis
- **Indoor humidity estimation** when sensor is offline

### 💰 Energy Savings
- **Live Ontario electricity pricing** (TOU/ULO/Tiered plans) with accurate time-of-use rates
- **Next rate preview** — see when prices change and plan accordingly
- **Cost calculator** — estimate heating/cooling costs in real-time
- **Savings tracker** — daily summaries of money saved vs. baseline behavior

### 🌱 Environmental Impact
- **Carbon footprint tracking** — kg CO₂ avoided through smart ventilation
- **Community projections** — model citywide impact if Kingston households adopt Goldilocks
- **Equivalences** — trees planted, km not driven, household energy comparisons

### 🤖 AI Assistant
- **Conversational chat** with live sensor data and weather context
- **Voice input/output** (browser-native Web Speech API — no dependencies)
- **Auto-generated suggestions** — proactive tips based on conditions, electricity rates, and weather forecasts

### ♿ Accessibility
- **Colorblind mode** — alternative color palettes (blue/teal/orange) for all visualizations
- **Toggle in settings** — persists via localStorage

### 📊 Data Visualization
- **24-hour humidity timeline** with trend analysis
- **Forecast preview** (3-hour intervals, precipitation probability)
- **Savings charts** — daily/monthly breakdowns
- **Carbon milestones** — cumulative impact with equivalences

---

## 🛠️ Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | Next.js 14, React 18, Tailwind CSS, SWR, Recharts, Web Speech API |
| **Backend** | Node.js, Express.js, better-sqlite3, Google Gemini AI SDK |
| **Hardware** | ESP32 Dev Module, DHT11 Sensor (Keystudio) |
| **APIs** | Google Gemini 2.0 (Flash/Flash-Lite), OpenWeatherMap |
| **Database** | SQLite (local) |
| **Deployment** | Vercel (frontend), Railway (backend, planned) |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** 18+ and npm
- **Arduino IDE** (for ESP32 firmware)
- **ESP32 board** + **DHT11 sensor** (optional — demo mode works without hardware)

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/goldilocks-kingston.git
cd goldilocks-kingston
```

### 2. Install Dependencies
```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 3. Environment Variables

Create a `.env` file in the **project root**:

```env
# Required
GEMINI_API=your_gemini_api_key_here

# Optional
OPENWEATHERMAP_API_KEY=your_openweathermap_key  # For live weather (falls back to mock data)
DEMO_MODE=false                                   # Set to 'true' for simulated sensor data
BACKEND_PORT=3001
```

**Get API keys:**
- [Google AI Studio](https://aistudio.google.com/app/apikey) (Gemini)
- [OpenWeatherMap](https://openweathermap.org/api) (Weather)

### 4. Run the Backend
```bash
cd backend
npm run dev
```

Backend will start on `http://localhost:3001`

### 5. Run the Frontend
```bash
cd frontend
npm run dev
```

Frontend will start on `http://localhost:3000`

### 6. (Optional) Flash ESP32 Sensor

1. Open `esp32_sensor/esp32_sensor.ino` in Arduino IDE
2. Install **DHT sensor library** (Adafruit DHT) via Library Manager
3. Update WiFi credentials and backend URL in the sketch:
   ```cpp
   const char* ssid = "Your_WiFi_SSID";
   const char* password = "Your_WiFi_Password";
   const char* serverUrl = "http://YOUR_BACKEND_IP:3001/api/readings";
   ```
4. Select **Board: ESP32 Dev Module** and flash

**Wiring:**
- DHT11 Data → GPIO2
- DHT11 VCC → 3.3V
- DHT11 GND → GND

---

## 📁 Project Structure

```
goldilocks-kingston/
├── backend/
│   ├── db/                  # SQLite database + init scripts
│   ├── logic/               # Business logic (AI, rates, weather, carbon, etc.)
│   ├── server.js            # Express API server
│   └── seedHistorical.js    # Data seeding script
├── frontend/
│   ├── components/          # React components
│   ├── lib/                 # API client, utilities, Context providers
│   ├── pages/               # Next.js pages (dashboard, carbon, savings, settings, chat)
│   └── styles/              # Global CSS + colorblind mode variables
├── esp32_sensor/
│   └── esp32_sensor.ino     # Arduino firmware for ESP32 + DHT11
├── gateway/
│   └── index.js             # (Legacy) Gateway for serial ESP32 data forwarding
├── PRD.md                   # Product requirements document
└── README.md
```

---

## 🎮 Demo Mode

No ESP32 hardware? No problem. Enable **demo mode** to simulate realistic sensor data:

1. Set `DEMO_MODE=true` in `.env`
2. Restart backend
3. Simulated readings will be generated automatically (temperature cycles, humidity patterns)

---

## 🎨 Colorblind Mode

1. Go to **Settings** → **Accessibility**
2. Toggle **"Colorblind Mode"**
3. All green/yellow/red indicators switch to blue/teal/orange

Affects: badges, charts, recommendation cards, carbon widgets, sensor status indicators.

---

## 📊 Electricity Rates

Rates sourced from **Utilities Kingston** (OEB Nov 1, 2025):

| Plan | Description | Key Rates |
|------|-------------|-----------|
| **TOU** | Time-of-Use | Off-Peak: 9.8¢, Mid-Peak: 15.7¢, On-Peak: 20.3¢ |
| **ULO** | Ultra-Low Overnight | Overnight: 3.9¢, Mid-Peak: 15.7¢, On-Peak: 39.1¢ |
| **Tiered** | Fixed tiers by usage | Tier 1: 10.3¢, Tier 2: 12.5¢ |

**Winter peak hours** (current):
- Weekdays: On-Peak 7–11am & 5–7pm, Mid-Peak 11am–5pm
- Weekends: All Off-Peak

Rates update dynamically based on EST timezone, season (winter/summer), and time of day.

---

## 🧪 Seeding Historical Data

To populate the database with 24 hours of backfilled readings (for testing/demos):

```bash
cd backend
node seedHistorical.js
```

This creates ~2,880 readings for the ESP32 sensor with realistic temperature/humidity patterns.

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/readings` | Receive sensor data (from ESP32) |
| `GET` | `/api/dashboard` | Dashboard data (indoor, outdoor, recommendations, savings, etc.) |
| `GET` | `/api/carbon` | Carbon impact data |
| `GET` | `/api/savings?period=today` | Savings breakdown |
| `GET` | `/api/notifications` | Smart suggestions & alerts |
| `POST` | `/api/chat` | Gemini AI chat |
| `GET` | `/api/settings` | User settings |
| `PUT` | `/api/settings` | Update settings |
| `GET` | `/api/humidity/timeline` | 24h humidity data |

---

## 🤝 Contributing

This is a QHacks 2026 hackathon project. Feel free to fork, experiment, and submit PRs!

---

## 📄 License

MIT License — see LICENSE file for details.

---

## 🙏 Acknowledgments

- **Ontario Energy Board** — Electricity rate data
- **OpenWeatherMap** — Weather API
- **Google Gemini AI** — Conversational intelligence
- **City of Kingston** — Community Energy Plan data
- **QHacks 2026** — Inspiration and deadline motivation 🚀

---

## 📧 Contact

Built by [Your Name/Team]  
QHacks 2026 | Kingston, Ontario

**GitHub:** [yourusername/goldilocks-kingston](https://github.com/yourusername/goldilocks-kingston)
