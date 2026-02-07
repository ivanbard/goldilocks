const RISK_COLORS = {
  LOW: { bar: 'bg-green-400', text: 'text-green-700', bg: 'bg-green-50' },
  MEDIUM: { bar: 'bg-yellow-400', text: 'text-yellow-700', bg: 'bg-yellow-50' },
  HIGH: { bar: 'bg-red-400', text: 'text-red-700', bg: 'bg-red-50' },
  UNKNOWN: { bar: 'bg-gray-300', text: 'text-gray-500', bg: 'bg-gray-50' },
};

export default function MoldRiskModule({ moldRisk }) {
  if (!moldRisk) return null;

  const { risk_level, risk_score, explanation, stats } = moldRisk;
  const colors = RISK_COLORS[risk_level] || RISK_COLORS.UNKNOWN;

  return (
    <div className="card">
      <h3 className="card-title">Mold Risk</h3>

      {/* Risk gauge */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1">
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
              style={{ width: `${Math.max(risk_score, 3)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>Low</span>
            <span>Medium</span>
            <span>High</span>
          </div>
        </div>
        <div className={`text-center px-3 py-1 rounded-lg ${colors.bg}`}>
          <p className={`text-2xl font-bold ${colors.text}`}>{risk_score}</p>
          <p className={`text-xs font-medium ${colors.text}`}>{risk_level}</p>
        </div>
      </div>

      {/* Explanation */}
      <p className="text-sm text-gray-600 mb-3">{explanation}</p>

      {/* Stats */}
      {stats && stats.readingCount > 0 && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-gray-50 rounded-lg p-2">
            <p className="text-lg font-semibold text-gray-800">
              {stats.current_humidity != null ? `${stats.current_humidity.toFixed(0)}%` : 'N/A'}
            </p>
            <p className="text-xs text-gray-500">Current RH</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2">
            <p className="text-lg font-semibold text-gray-800">
              {(stats.minutes_over_60 / 60).toFixed(1)}h
            </p>
            <p className="text-xs text-gray-500">&gt;60% today</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2">
            <p className="text-lg font-semibold text-gray-800">
              {(stats.minutes_over_70 / 60).toFixed(1)}h
            </p>
            <p className="text-xs text-gray-500">&gt;70% today</p>
          </div>
        </div>
      )}
    </div>
  );
}
