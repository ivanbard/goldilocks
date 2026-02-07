import { useState, useEffect } from 'react';
import { useUser, postPreferences } from '../lib/api';

export default function SettingsPage() {
  const { data: user, mutate } = useUser();
  const [form, setForm] = useState({
    plan_type: 'TOU',
    comfort_min: 20,
    comfort_max: 23,
    room_kwh_per_degC: 0.1,
    ac_cop: 3.0,
    postal_code: 'K7L',
    housing_type: 'apartment',
    floor_level: 2,
    lifestyle_notes: '',
    quiet_hours_start: '22:00',
    quiet_hours_end: '07:00',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Populate form from user data
  useEffect(() => {
    if (user) {
      setForm((prev) => ({
        ...prev,
        plan_type: user.plan_type || prev.plan_type,
        comfort_min: user.comfort_min ?? prev.comfort_min,
        comfort_max: user.comfort_max ?? prev.comfort_max,
        room_kwh_per_degC: user.room_kwh_per_degC ?? prev.room_kwh_per_degC,
        ac_cop: user.ac_cop ?? prev.ac_cop,
        postal_code: user.postal_code || prev.postal_code,
        housing_type: user.profile?.housing_type || prev.housing_type,
        floor_level: user.profile?.floor_level ?? prev.floor_level,
        lifestyle_notes: user.profile?.lifestyle_notes || prev.lifestyle_notes,
        quiet_hours_start: user.profile?.quiet_hours_start || prev.quiet_hours_start,
        quiet_hours_end: user.profile?.quiet_hours_end || prev.quiet_hours_end,
      }));
    }
  }, [user]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await postPreferences(form);
      mutate();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold text-gray-900">Settings</h2>

      {/* Electricity Plan */}
      <div className="card">
        <h3 className="card-title">Electricity Plan</h3>
        <div className="grid grid-cols-3 gap-2">
          {['TOU', 'ULO', 'TIERED'].map((plan) => (
            <button
              key={plan}
              onClick={() => handleChange('plan_type', plan)}
              className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                form.plan_type === plan
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              {plan === 'TOU' && '⏰ Time-of-Use'}
              {plan === 'ULO' && '🌙 Ultra-Low Overnight'}
              {plan === 'TIERED' && '📊 Tiered'}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Check your Utilities Kingston bill for your current plan.
        </p>
      </div>

      {/* Comfort Zone */}
      <div className="card">
        <h3 className="card-title">Comfort Zone</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-600 block mb-1">Minimum (°C)</label>
            <input
              type="number"
              step="0.5"
              value={form.comfort_min}
              onChange={(e) => handleChange('comfort_min', parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 block mb-1">Maximum (°C)</label>
            <input
              type="number"
              step="0.5"
              value={form.comfort_max}
              onChange={(e) => handleChange('comfort_max', parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          The range where you feel comfortable. Default: 20–23°C.
        </p>
      </div>

      {/* Room & Efficiency */}
      <div className="card">
        <h3 className="card-title">Room & Efficiency</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-600 block mb-1">kWh per °C</label>
            <input
              type="number"
              step="0.01"
              value={form.room_kwh_per_degC}
              onChange={(e) => handleChange('room_kwh_per_degC', parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-400 mt-1">Energy needed per degree change</p>
          </div>
          <div>
            <label className="text-sm text-gray-600 block mb-1">AC COP</label>
            <input
              type="number"
              step="0.5"
              value={form.ac_cop}
              onChange={(e) => handleChange('ac_cop', parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-400 mt-1">AC efficiency (higher = cheaper cooling)</p>
          </div>
        </div>
      </div>

      {/* Housing Info */}
      <div className="card">
        <h3 className="card-title">Housing Info</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600 block mb-1">Housing Type</label>
              <select
                value={form.housing_type}
                onChange={(e) => handleChange('housing_type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="dorm">Dorm</option>
                <option value="apartment">Apartment</option>
                <option value="house">House</option>
                <option value="basement">Basement</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600 block mb-1">Floor Level</label>
              <input
                type="number"
                value={form.floor_level}
                onChange={(e) => handleChange('floor_level', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-600 block mb-1">Postal Code</label>
            <input
              type="text"
              value={form.postal_code}
              onChange={(e) => handleChange('postal_code', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="K7L"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 block mb-1">Lifestyle Notes</label>
            <textarea
              value={form.lifestyle_notes}
              onChange={(e) => handleChange('lifestyle_notes', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={2}
              placeholder="e.g., I cook a lot, basement apartment, allergies..."
            />
            <p className="text-xs text-gray-400 mt-1">Helps personalize recommendations</p>
          </div>
        </div>
      </div>

      {/* Notification Quiet Hours */}
      <div className="card">
        <h3 className="card-title">Notification Quiet Hours</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-600 block mb-1">Start</label>
            <input
              type="time"
              value={form.quiet_hours_start}
              onChange={(e) => handleChange('quiet_hours_start', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 block mb-1">End</label>
            <input
              type="time"
              value={form.quiet_hours_end}
              onChange={(e) => handleChange('quiet_hours_end', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">No notifications during these hours.</p>
      </div>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
        {saved && (
          <span className="text-sm text-green-600 font-medium">✓ Settings saved!</span>
        )}
      </div>
    </div>
  );
}
