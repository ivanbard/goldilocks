import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useReadings } from '../lib/api';

export default function HumidityTimeline({ deviceId }) {
  const { data: readings, error } = useReadings(deviceId || 'demo-device-001', 1440);

  if (error) {
    return (
      <div className="card">
        <h3 className="card-title">24h Humidity Timeline</h3>
        <p className="text-sm text-red-500">Failed to load humidity data.</p>
      </div>
    );
  }

  if (!readings || readings.length === 0) {
    return (
      <div className="card">
        <h3 className="card-title">24h Humidity Timeline</h3>
        <p className="text-sm text-gray-400">No humidity data yet.</p>
      </div>
    );
  }

  // Process readings for chart (reverse to chronological, sample for performance)
  const sorted = [...readings]
    .reverse()
    .filter((r) => r.humidity_RH != null);

  // Sample every Nth reading to keep chart fast
  const step = Math.max(1, Math.floor(sorted.length / 200));
  const chartData = sorted
    .filter((_, i) => i % step === 0)
    .map((r) => ({
      time: new Date(r.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      humidity: r.humidity_RH,
      temp: r.temp_C,
    }));

  if (chartData.length === 0) {
    return (
      <div className="card">
        <h3 className="card-title">24h Humidity Timeline</h3>
        <p className="text-sm text-gray-400">No humidity data available. Connect a humidity sensor.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="card-title">24h Humidity &amp; Temperature Timeline</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="humidity"
              domain={[30, 100]}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              label={{ value: '%RH', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#9ca3af' } }}
            />
            <YAxis
              yAxisId="temp"
              orientation="right"
              domain={[10, 35]}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              label={{ value: '°C', angle: 90, position: 'insideRight', style: { fontSize: 11, fill: '#9ca3af' } }}
            />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
            />
            <ReferenceLine yAxisId="humidity" y={60} stroke="#eab308" strokeDasharray="5 5" label={{ value: '60%', fontSize: 10, fill: '#eab308' }} />
            <ReferenceLine yAxisId="humidity" y={70} stroke="#ef4444" strokeDasharray="5 5" label={{ value: '70%', fontSize: 10, fill: '#ef4444' }} />
            <Line
              yAxisId="humidity"
              type="monotone"
              dataKey="humidity"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              name="Humidity %"
            />
            <Line
              yAxisId="temp"
              type="monotone"
              dataKey="temp"
              stroke="#f97316"
              strokeWidth={1.5}
              dot={false}
              name="Temp °C"
              strokeDasharray="4 2"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-4 justify-center mt-2 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 inline-block"></span> Humidity</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-orange-500 inline-block" style={{ borderTop: '2px dashed #f97316' }}></span> Temp</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-yellow-500 inline-block" style={{ borderTop: '2px dashed #eab308' }}></span> 60% risk</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-500 inline-block" style={{ borderTop: '2px dashed #ef4444' }}></span> 70% risk</span>
      </div>
    </div>
  );
}
