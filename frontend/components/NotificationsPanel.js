import { useNotifications, markNotificationRead } from '../lib/api';
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

  if (!notifications || notifications.length === 0) return null;

  const unread = notifications.filter((n) => !n.read_at);
  const display = expanded ? notifications : notifications.slice(0, 3);

  const handleMarkRead = async (id) => {
    await markNotificationRead(id);
    mutate();
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="card-title mb-0">
          Notifications
          {unread.length > 0 && (
            <span className="badge badge-red ml-2">{unread.length} new</span>
          )}
        </h3>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-blue-500 hover:text-blue-700"
        >
          {expanded ? 'Show less' : 'Show all'}
        </button>
      </div>
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
