const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getESTNow() {
  const estStr = new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' });
  return new Date(estStr);
}

function getNextRate(schedule, currentRate) {
  if (!schedule || schedule.planType === 'TIERED') return null;

  const now = getESTNow();
  const currentHour = now.getHours();
  const currentDay = now.getDay(); // 0=Sun, 6=Sat
  const isWeekend = currentDay === 0 || currentDay === 6;
  const todayPeriods = isWeekend ? schedule.weekend : schedule.weekday;

  // First: check remaining periods TODAY for a different rate
  if (todayPeriods) {
    for (const p of todayPeriods) {
      if (p.start > currentHour && p.rate !== currentRate) {
        return { rate: p.rate, label: p.label, startHour: p.start, dayLabel: 'today' };
      }
    }
  }

  // Next: scan up to 7 days ahead for the first different rate
  for (let d = 1; d <= 7; d++) {
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + d);
    const futureDay = futureDate.getDay();
    const isFutureWeekend = futureDay === 0 || futureDay === 6;
    const periods = isFutureWeekend ? schedule.weekend : schedule.weekday;
    if (!periods) continue;

    for (const p of periods) {
      if (p.rate !== currentRate) {
        const dayLabel = d === 1 ? 'tmrw' : DAYS[futureDay];
        return { rate: p.rate, label: p.label, startHour: p.start, dayLabel };
      }
    }
  }

  return null;
}

function formatHour(hour, dayLabel) {
  const suffix = hour >= 12 ? 'pm' : 'am';
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const dayPart = dayLabel && dayLabel !== 'today' ? ` ${dayLabel}` : '';
  return `${display}${suffix}${dayPart}`;
}

export default function ElectricityPriceChip({ electricity }) {
  if (!electricity) return null;

  const { price_cents_per_kWh, periodLabel, planType, season, schedule } = electricity;

  // Color based on rate
  let chipColor = 'badge-green';
  if (price_cents_per_kWh >= 15) chipColor = 'badge-red';
  else if (price_cents_per_kWh >= 10) chipColor = 'badge-yellow';

  const next = getNextRate(schedule, price_cents_per_kWh);

  let nextChipColor = 'badge-green';
  if (next) {
    if (next.rate >= 15) nextChipColor = 'badge-red';
    else if (next.rate >= 10) nextChipColor = 'badge-yellow';
  }

  return (
    <div className="card h-full flex flex-col justify-between">
      <div>
        <h3 className="card-title">Electricity Price</h3>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">⚡</span>
              <span className={`badge ${chipColor}`}>
                {periodLabel}
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-2">
              {price_cents_per_kWh.toFixed(1)}¢<span className="text-sm font-normal text-gray-500">/kWh</span>
            </p>
          </div>
          <div className="text-right text-sm text-gray-500">
            <p>Plan: {planType}</p>
            <p className="capitalize">{season}</p>
          </div>
        </div>
      </div>

      {/* Next rate */}
      {next && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Next</span>
              <span className={`badge ${nextChipColor} text-xs`}>
                {next.label}
              </span>
            </div>
            <span className="text-xs text-gray-400">at {formatHour(next.startHour, next.dayLabel)}</span>
          </div>
          <p className="text-lg font-semibold text-gray-700 mt-1">
            {next.rate.toFixed(1)}¢<span className="text-xs font-normal text-gray-400">/kWh</span>
          </p>
        </div>
      )}
    </div>
  );
}
