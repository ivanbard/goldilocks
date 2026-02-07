export default function SavingsWidget({ costEstimate, todaySavings }) {
  if (!costEstimate) return null;

  const { hvac_cost, cost_window, savings, mode, assumptions } = costEstimate;

  return (
    <div className="card">
      <h3 className="card-title">Cost Estimate (Next Hour)</h3>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{mode === 'AC' ? '❄️' : mode === 'HEAT' ? '🔥' : '—'}</span>
            <span className="text-sm text-gray-600">
              {mode === 'AC' ? 'AC cost' : mode === 'HEAT' ? 'Heating cost' : 'HVAC cost'}
            </span>
          </div>
          <span className="text-lg font-semibold text-gray-900">
            ${hvac_cost.toFixed(4)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🪟</span>
            <span className="text-sm text-gray-600">Window cost</span>
          </div>
          <span className="text-lg font-semibold" style={{ color: 'var(--color-success-text-bold)' }}>$0.00</span>
        </div>
        <hr className="border-gray-100" />
        <div className="flex items-center justify-between rounded-lg p-3 -mx-1" style={{ backgroundColor: 'var(--color-success-bg)' }}>
          <span className="text-sm font-medium" style={{ color: 'var(--color-success-text)' }}>💰 Potential savings</span>
          <span className="text-xl font-bold" style={{ color: 'var(--color-success-text-bold)' }}>${savings.toFixed(4)}</span>
        </div>

        {todaySavings && (
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Today&apos;s total savings</span>
            <span className="font-medium">${(todaySavings.dollars_saved_est || 0).toFixed(2)}</span>
          </div>
        )}

        <p className="text-xs text-gray-400 mt-2">
          Based on {assumptions.kWh_per_degC} kWh/°C, COP {assumptions.ac_cop}, {assumptions.room_volume_m3}m³ room
        </p>
      </div>
    </div>
  );
}
