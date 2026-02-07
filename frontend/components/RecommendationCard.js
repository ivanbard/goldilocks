import { useState } from 'react';

const STATE_STYLES = {
  OPEN_WINDOW: { bg: 'bg-green-50 border-green-200', icon: '🪟', color: 'text-green-700' },
  USE_AC: { bg: 'bg-blue-50 border-blue-200', icon: '❄️', color: 'text-blue-700' },
  USE_HEAT: { bg: 'bg-orange-50 border-orange-200', icon: '🔥', color: 'text-orange-700' },
  DO_NOTHING: { bg: 'bg-gray-50 border-gray-200', icon: '✅', color: 'text-gray-700' },
};

export default function RecommendationCard({ recommendation }) {
  const [showReasons, setShowReasons] = useState(false);

  if (!recommendation) return null;

  const { state, confidence, reasons, text, proactive_tip, humidity_tip, comfort_period } = recommendation;
  const style = STATE_STYLES[state] || STATE_STYLES.DO_NOTHING;

  return (
    <div className={`rounded-xl border-2 p-6 ${style.bg}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{style.icon}</span>
            <span className={`badge ${
              confidence === 'HIGH' ? 'badge-green' :
              confidence === 'MEDIUM' ? 'badge-yellow' : 'badge-gray'
            }`}>
              {confidence} confidence
            </span>
            {comfort_period === 'night' && (
              <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">🌙 Night mode</span>
            )}
          </div>
          <p className={`text-xl font-semibold ${style.color} mt-2`}>{text}</p>
          {/* Proactive forecast tip */}
          {proactive_tip && (
            <p className="text-sm text-gray-600 mt-2 bg-white/50 rounded-lg px-3 py-2">{proactive_tip}</p>
          )}
          {/* Humidity / AC efficiency tip */}
          {humidity_tip && (
            <p className="text-sm text-amber-700 mt-2 bg-amber-50/50 rounded-lg px-3 py-2">{humidity_tip}</p>
          )}
        </div>
        <button
          onClick={() => setShowReasons(!showReasons)}
          className="ml-4 px-4 py-2 bg-white rounded-lg shadow-sm border border-gray-200 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
        >
          {showReasons ? 'Hide' : 'Why?'}
        </button>
      </div>

      {showReasons && reasons && reasons.length > 0 && (
        <div className="mt-4 bg-white/70 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-600 mb-2">Here&apos;s why:</h4>
          <ul className="space-y-1">
            {reasons.map((reason, i) => (
              <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                <span className="text-gray-400 mt-0.5">•</span>
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
