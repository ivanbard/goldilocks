import { useNotifications, markNotificationRead, generateSuggestions } from '../lib/api';
import { useState } from 'react';

const TRIGGER_ICONS = {
  mold_risk: '🍄',
  savings_opportunity: '💰',
  weather_alert: '⛈️',
  pattern: '📊',
  general: '💡',
};

export default function NotificationsPanel() {
  const { data: notifications, mutate } = useNotifications();
  const [expanded, setExpanded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [llmError, setLlmError] = useState(null);

  const handleGenerate = async () => {
    setGenerating(true);
    setLlmError(null);
    try {
      const result = await generateSuggestions();
      if (result.error) {
        setLlmError(result.error);
      }
      mutate(); // refresh notifications list
    } catch (err) {
      setLlmError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const unread = (notifications || []).filter((n) => !n.read_at);
  const display = expanded ? (notifications || []) : (notifications || []).slice(0, 5);

  const handleMarkRead = async (id) => {
    await markNotificationRead(id);
    mutate();
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="card-title mb-0">
          Smart Suggestions
          {unread.length > 0 && (
            <span className="badge badge-red ml-2">{unread.length} new</span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            {generating ? (
              <><span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" /> Thinking...</>
            ) : (
              <><span>✨</span> Get AI Tips</>
            )}
          </button>
          {(notifications || []).length > 3 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-blue-500 hover:text-blue-700"
            >
              {expanded ? 'Show less' : 'Show all'}
            </button>
          )}
        </div>
      </div>
      {llmError && (
        <p className="text-xs text-red-500 mb-2">⚠️ {llmError}</p>
      )}
      <div className="space-y-2">
        {display.map((n) => (
          <div
            key={n.id}
            className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
              n.read_at ? 'bg-gray-50' : 'bg-blue-50 border border-blue-100'
            }`}
          >
            <span className="text-lg">{TRIGGER_ICONS[n.trigger_type] || '💡'}</span>
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${n.read_at ? 'text-gray-500' : 'text-gray-700 font-medium'}`}>
                {n.message_text}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {new Date(n.ts).toLocaleString()}
              </p>
            </div>
            {!n.read_at && (
              <button
                onClick={() => handleMarkRead(n.id)}
                className="text-xs text-blue-500 hover:text-blue-700 whitespace-nowrap"
              >
                Mark read
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
