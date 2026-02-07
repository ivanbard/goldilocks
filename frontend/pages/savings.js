import { useState } from 'react';
import { useSavings } from '../lib/api';
import { useColorblindMode, getChartColors } from '../lib/ColorblindContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const TABS = ['today', 'month', 'all'];

export default function SavingsPage() {
  const [tab, setTab] = useState('month');
  const { data, error, isLoading } = useSavings(tab);
  const { colorblindMode } = useColorblindMode();
  const chartColors = getChartColors(colorblindMode);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card bg-red-50 border-red-200">
        <p className="text-red-600">Failed to load savings data. Is the backend running?</p>
      </div>
    );
  }

  const chartData = (data?.dailyBreakdown || [])
    .slice()
    .reverse()
    .map((d) => ({
      date: d.date.substring(5), // MM-DD
      saved: d.dollars_saved_est,
      kwh: d.kwh_saved_est,
    }));

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Savings</h2>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
              tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'all' ? 'All Time' : t}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card" style={{ backgroundColor: 'var(--color-success-bg)', borderColor: 'var(--color-success-border)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--color-success-text-bold)' }}>Money Saved</p>
          <p className="text-3xl font-bold mt-1" style={{ color: 'var(--color-success-text)' }}>
            ${(data?.dollars_saved || 0).toFixed(2)}
          </p>
        </div>
        <div className="card bg-blue-50 border-blue-100">
          <p className="text-sm text-blue-600 font-medium">Energy Saved</p>
          <p className="text-3xl font-bold text-blue-700 mt-1">
            {(data?.kwh_saved || 0).toFixed(2)} <span className="text-lg">kWh</span>
          </p>
        </div>
        <div className="card bg-gray-50">
          <p className="text-sm text-gray-600 font-medium">Days Tracked</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{data?.days || 0}</p>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="card">
          <h3 className="card-title">Daily Savings ($)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                  formatter={(val) => [`$${val.toFixed(4)}`, 'Saved']}
                />
                <Bar dataKey="saved" fill={chartColors.savingsBar} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Assumptions */}
      {data?.assumptions && (
        <div className="card">
          <h3 className="card-title">How We Estimate</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-400">Energy per °C</p>
              <p className="font-medium text-gray-700">{data.assumptions.kWh_per_degC} kWh</p>
            </div>
            <div>
              <p className="text-gray-400">AC Efficiency (COP)</p>
              <p className="font-medium text-gray-700">{data.assumptions.ac_cop}</p>
            </div>
            <div>
              <p className="text-gray-400">Room Volume</p>
              <p className="font-medium text-gray-700">{data.assumptions.room_volume_m3} m³</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            These are rough estimates. Adjust in Settings for more accurate numbers.
          </p>
        </div>
      )}
    </div>
  );
}
