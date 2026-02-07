import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea } from 'recharts';
import { useReadings, useDashboard } from '../lib/api';

export default function HumidityTimeline({ deviceId }) {
  const { data: readings, error } = useReadings(deviceId || 'demo-device-001', 1440);
  const { data: dashboard } = useDashboard();

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

  const comfortMin = dashboard?.user?.comfort_min ?? 20;
  const comfortMax = dashboard?.user?.comfort_max ?? 23;

  return (
    <div className="card">
      <h3 className="card-title">24h Temperature &amp; Humidity Timeline</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="temp"
              domain={[Math.min(10, comfortMin - 5), Math.max(35, comfortMax + 5)]}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              label={{ value: '°C', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#9ca3af' } }}
            />
            <YAxis
              yAxisId="humidity"
              orientation="right"
              domain={[30, 100]}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              label={{ value: '%RH', angle: 90, position: 'insideRight', style: { fontSize: 11, fill: '#9ca3af' } }}
            />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
            />
            {/* Gold comfort zone band */}
            <ReferenceArea yAxisId="temp" y1={comfortMin} y2={comfortMax} fill="#f59e0b" fillOpacity={0.12} />
            <ReferenceLine yAxisId="temp" y={comfortMin} stroke="#f59e0b" strokeDasharray="5 5" label={{ value: `${comfortMin}°`, fontSize: 10, fill: '#f59e0b' }} />
            <ReferenceLine yAxisId="temp" y={comfortMax} stroke="#f59e0b" strokeDasharray="5 5" label={{ value: `${comfortMax}°`, fontSize: 10, fill: '#f59e0b' }} />
            {/* Humidity risk thresholds */}
            <ReferenceLine yAxisId="humidity" y={60} stroke="#eab308" strokeDasharray="3 3" strokeOpacity={0.5} />
            <ReferenceLine yAxisId="humidity" y={70} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
            {/* Blue line = actual temperature */}
            <Line
              yAxisId="temp"
              type="monotone"
              dataKey="temp"
              stroke="#3b82f6"
              strokeWidth={2.5}
              dot={false}
              name="Temperature °C"
            />
            {/* Gray dashed line = humidity */}
            <Line
              yAxisId="humidity"
              type="monotone"
              dataKey="humidity"
              stroke="#9ca3af"
              strokeWidth={1.5}
              dot={false}
              name="Humidity %"
              strokeDasharray="4 2"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-4 justify-center mt-2 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-blue-500 inline-block"></span> Temperature</span>
        <span className="flex items-center gap-1"><span className="w-4 h-3 bg-amber-400/20 border border-amber-400 inline-block rounded-sm"></span> Comfort zone</span>
        <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-gray-400 inline-block" style={{ borderTop: '2px dashed #9ca3af' }}></span> Humidity</span>
      </div>
    </div>
  );
}
