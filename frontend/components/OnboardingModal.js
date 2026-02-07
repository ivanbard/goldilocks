import { useState } from 'react';
import { postPreferences } from '../lib/api';

const STEPS = ['welcome', 'name', 'location', 'housing', 'comfort', 'plan', 'done'];

export default function OnboardingModal({ onComplete }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: '',
    postal_code: 'K7L',
    housing_type: 'apartment',
    comfort_min: 20,
    comfort_max: 23,
    comfort_min_night: 18,
    comfort_max_night: 21,
    plan_type: 'TOU',
    heating_source: 'gas',
  });

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const next = () => setStep(s => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setStep(s => Math.max(s - 1, 0));

  const finish = async () => {
    try {
      await postPreferences(form);
      onComplete();
    } catch (e) {
      console.error('Onboarding save error:', e);
      onComplete(); // still dismiss
    }
  };

  const stepName = STEPS[step];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>

        <div className="p-8">
          {/* Welcome */}
          {stepName === 'welcome' && (
            <div className="text-center space-y-4">
              <span className="text-6xl">🐻</span>
              <h2 className="text-2xl font-bold text-gray-900">Welcome to Goldilocks!</h2>
              <p className="text-gray-600">
                Your smart ventilation assistant for Kingston. Let&apos;s get you set up in under a minute.
              </p>
              <p className="text-sm text-gray-400">
                We&apos;ll help you find the &quot;just right&quot; balance between comfort, cost, and air quality.
              </p>
            </div>
          )}

          {/* Name */}
          {stepName === 'name' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900">What&apos;s your name?</h2>
              <input
                type="text"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                autoFocus
              />
            </div>
          )}

          {/* Location */}
          {stepName === 'location' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900">Where do you live?</h2>
              <p className="text-sm text-gray-500">We use this for local weather and electricity rates.</p>
              <input
                type="text"
                value={form.postal_code}
                onChange={e => set('postal_code', e.target.value.toUpperCase())}
                placeholder="Postal code (e.g. K7L)"
                maxLength={7}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                autoFocus
              />
            </div>
          )}

          {/* Housing */}
          {stepName === 'housing' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900">What type of home?</h2>
              <p className="text-sm text-gray-500">Helps us estimate energy usage and room size.</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { val: 'dorm', icon: '🎓', label: 'Dorm' },
                  { val: 'apartment', icon: '🏢', label: 'Apartment' },
                  { val: 'house', icon: '🏠', label: 'House' },
                  { val: 'basement', icon: '🏚️', label: 'Basement' },
                ].map(({ val, icon, label }) => (
                  <button
                    key={val}
                    onClick={() => set('housing_type', val)}
                    className={`p-4 rounded-xl border-2 text-center transition-all ${
                      form.housing_type === val
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-2xl block mb-1">{icon}</span>
                    <span className="text-sm font-medium">{label}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-3 mt-3">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Heating Source</h3>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { val: 'gas', icon: '🔥', label: 'Gas' },
                  { val: 'electric', icon: '⚡', label: 'Electric' },
                  { val: 'heatpump', icon: '❄️', label: 'Heat Pump' },
                ].map(({ val, icon, label }) => (
                  <button
                    key={val}
                    onClick={() => set('heating_source', val)}
                    className={`p-3 rounded-lg border-2 text-sm transition-all ${
                      form.heating_source === val
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {icon} {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Comfort preferences */}
          {stepName === 'comfort' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900">Temperature preferences</h2>
              <div>
                <p className="text-sm text-gray-500 mb-2">☀️ Daytime comfort (°C)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400">Min</label>
                    <input type="number" step="0.5" value={form.comfort_min} onChange={e => set('comfort_min', parseFloat(e.target.value))}
                      className="w-full px-3 py-2 border rounded-lg" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Max</label>
                    <input type="number" step="0.5" value={form.comfort_max} onChange={e => set('comfort_max', parseFloat(e.target.value))}
                      className="w-full px-3 py-2 border rounded-lg" />
                  </div>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-2">🌙 Nighttime comfort (°C)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400">Min</label>
                    <input type="number" step="0.5" value={form.comfort_min_night} onChange={e => set('comfort_min_night', parseFloat(e.target.value))}
                      className="w-full px-3 py-2 border rounded-lg" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Max</label>
                    <input type="number" step="0.5" value={form.comfort_max_night} onChange={e => set('comfort_max_night', parseFloat(e.target.value))}
                      className="w-full px-3 py-2 border rounded-lg" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Electricity plan */}
          {stepName === 'plan' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900">Electricity Plan</h2>
              <p className="text-sm text-gray-500">Check your Utilities Kingston bill for your current plan.</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { val: 'TOU', icon: '⏰', label: 'Time-of-Use' },
                  { val: 'ULO', icon: '🌙', label: 'Ultra-Low Overnight' },
                  { val: 'TIERED', icon: '📊', label: 'Tiered' },
                ].map(({ val, icon, label }) => (
                  <button
                    key={val}
                    onClick={() => set('plan_type', val)}
                    className={`p-3 rounded-xl border-2 text-center text-sm transition-all ${
                      form.plan_type === val
                        ? 'border-amber-500 bg-amber-50 font-medium'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="block text-lg mb-1">{icon}</span>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Done */}
          {stepName === 'done' && (
            <div className="text-center space-y-4">
              <span className="text-6xl">🎉</span>
              <h2 className="text-2xl font-bold text-gray-900">
                {form.name ? `Welcome, ${form.name}!` : 'All set!'}
              </h2>
              <p className="text-gray-600">
                Goldilocks is now monitoring your home. We&apos;ll tell you exactly when to open your windows for the best comfort, savings, and air quality.
              </p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="border-t px-8 py-4 flex justify-between items-center bg-gray-50">
          {step > 0 && stepName !== 'done' ? (
            <button onClick={prev} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>
          ) : <div />}
          {stepName === 'done' ? (
            <button onClick={finish} className="px-6 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600">
              Start using Goldilocks →
            </button>
          ) : (
            <button onClick={next} className="px-6 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600">
              {stepName === 'welcome' ? 'Get Started' : 'Next →'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
