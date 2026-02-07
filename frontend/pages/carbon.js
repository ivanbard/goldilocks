import { useCarbon } from '../lib/api';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const LEAF = '🌿';
const TREE = '🌳';
const CAR = '🚗';
const BOLT = '⚡';
const GLOBE = '🌍';
const CITY = '🏘️';
const CLOCK = '⏳';

function StatCard({ icon, value, unit, label, accent = 'emerald', sub }) {
  const colors = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[accent]}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">{icon}</span>
        <span className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</span>
      </div>
      <p className="text-2xl font-bold">
        {value} <span className="text-sm font-normal opacity-70">{unit}</span>
      </p>
      {sub && <p className="text-xs mt-1 opacity-60">{sub}</p>}
    </div>
  );
}

function GenerationalTimeline({ data }) {
  if (!data?.length) return null;

  return (
    <div className="space-y-4">
      {data.map((milestone, i) => (
        <div key={milestone.years} className="flex gap-4">
          {/* Timeline connector */}
          <div className="flex flex-col items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
              i === 0 ? 'bg-emerald-500 text-white' :
              i === data.length - 1 ? 'bg-amber-500 text-white' :
              'bg-emerald-100 text-emerald-700'
            }`}>
              {milestone.years}y
            </div>
            {i < data.length - 1 && <div className="w-0.5 h-full bg-emerald-200 min-h-[2rem]" />}
          </div>
          
          {/* Content */}
          <div className="pb-4 flex-1">
            <div className="flex items-baseline gap-2">
              <h4 className="font-semibold text-gray-900">{milestone.label}</h4>
              <span className="text-sm text-emerald-600 font-medium">
                {milestone.cumulative_tonnes.toLocaleString()} tonnes CO₂
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{milestone.description}</p>
            <div className="flex gap-4 mt-1 text-xs text-gray-400">
              <span>{TREE} {milestone.trees_equivalent.toLocaleString()} trees equivalent</span>
              <span>{CAR} {milestone.km_equivalent.toLocaleString()} km not driven</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CarbonPage() {
  const { data, error, isLoading } = useCarbon();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border bg-red-50 border-red-200 p-6">
        <p className="text-red-600">Failed to load carbon data. Is the backend running?</p>
      </div>
    );
  }

  const chartData = (data?.dailyBreakdown || [])
    .slice(-30)
    .map(d => ({
      date: d.date.substring(5),
      co2: Math.round(d.co2_saved_g),
      cumulative: Math.round(d.cumulative_co2_g),
    }));

  const eq = data?.equivalences || {};
  const community = data?.community || {};
  const total = data?.total || {};

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-8 text-white">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-4xl">{GLOBE}</span>
          <div>
            <h2 className="text-2xl font-bold">Carbon Impact</h2>
            <p className="text-emerald-100 text-sm">Your contribution to Kingston&apos;s sustainable future</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div>
            <p className="text-3xl font-bold">{(total.co2_saved_kg || 0).toFixed(2)}</p>
            <p className="text-emerald-200 text-sm">kg CO₂ avoided</p>
          </div>
          <div>
            <p className="text-3xl font-bold">{total.days_tracked || 0}</p>
            <p className="text-emerald-200 text-sm">days tracked</p>
          </div>
          <div>
            <p className="text-3xl font-bold">{(data?.today?.co2_saved_g || 0).toFixed(0)}</p>
            <p className="text-emerald-200 text-sm">g CO₂ saved today</p>
          </div>
          <div>
            <p className="text-3xl font-bold">{data?.user_heating_source || 'gas'}</p>
            <p className="text-emerald-200 text-sm">heating source</p>
          </div>
        </div>
      </div>

      {/* Equivalences */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">What your savings equal</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={TREE} value={eq.trees_equivalent || 0} unit="trees" label="Annual equivalent" accent="emerald"
            sub="Mature trees absorbing CO₂ for a year" />
          <StatCard icon={CAR} value={eq.km_not_driven || 0} unit="km" label="Not driven" accent="blue"
            sub="Average car emissions avoided" />
          <StatCard icon="📱" value={eq.phone_charges || 0} unit="charges" label="Phone charges" accent="purple"
            sub="Smartphone charging cycles" />
          <StatCard icon="🚿" value={eq.shower_minutes_saved || 0} unit="min" label="Hot water saved" accent="amber"
            sub="Minutes of hot shower emissions" />
        </div>
      </div>

      {/* Daily CO2 Chart */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily CO₂ Reductions</h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="g" />
              <Tooltip
                formatter={(v) => [`${v} g`, 'CO₂ saved']}
                contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
              />
              <Bar dataKey="co2" fill="#10b981" radius={[4, 4, 0, 0]} name="CO₂ saved (g)" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-400 text-center py-8">No data yet — keep using Goldilocks!</p>
        )}
      </div>

      {/* Cumulative Chart */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Cumulative CO₂ Impact</h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="g" />
              <Tooltip
                formatter={(v) => [`${v} g`, 'Total CO₂ saved']}
                contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
              />
              <Area type="monotone" dataKey="cumulative" fill="#d1fae5" stroke="#059669" strokeWidth={2} name="Cumulative (g)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-400 text-center py-8">Tracking will begin with your first reading</p>
        )}
      </div>

      {/* Community Impact */}
      <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/50 p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">{CITY}</span>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Kingston Community Impact</h3>
            <p className="text-sm text-gray-500">
              If all {community.kingston_households?.toLocaleString()} households adopted Goldilocks
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-3 border border-emerald-100">
            <p className="text-2xl font-bold text-emerald-700">{community.annual_community_tonnes?.toLocaleString() || 0}</p>
            <p className="text-xs text-gray-500">tonnes CO₂/year</p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-emerald-100">
            <p className="text-2xl font-bold text-emerald-700">{community.annual_community_trees?.toLocaleString() || 0}</p>
            <p className="text-xs text-gray-500">trees equivalent/year</p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-emerald-100">
            <p className="text-2xl font-bold text-emerald-700">{(community.pct_reduction || 0).toFixed(2)}%</p>
            <p className="text-xs text-gray-500">of residential emissions</p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-emerald-100">
            <p className="text-2xl font-bold text-emerald-700">{(community.annual_user_kg || 0).toFixed(1)}</p>
            <p className="text-xs text-gray-500">kg CO₂ you save/year</p>
          </div>
        </div>
      </div>

      {/* Generational Timeline — Golden Age */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-2 mb-6">
          <span className="text-2xl">{CLOCK}</span>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">The Golden Age Legacy</h3>
            <p className="text-sm text-gray-500">Kingston&apos;s projected impact across generations</p>
          </div>
        </div>
        <GenerationalTimeline data={data?.generational} />
      </div>

      {/* Methodology note */}
      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-xs text-gray-400">
        <p className="font-medium text-gray-500 mb-1">Methodology</p>
        <p>
          Carbon calculations use Ontario grid intensity (35 g CO₂/kWh for electricity) and 
          natural gas furnace emissions (185 g CO₂/kWh thermal at 92% efficiency). 
          Community projections based on Kingston CMA ~{community.kingston_households?.toLocaleString()} households 
          averaging {5} tonnes CO₂/year for residential heating. Data sourced from NRCan, 
          Environment Canada, and the City of Kingston Community Energy Plan.
        </p>
      </div>

      {/* Health & Accessibility Impact */}
      <div className="rounded-xl border-2 border-blue-200 bg-blue-50/50 p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🏥</span>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Health &amp; Accessibility Impact</h3>
            <p className="text-sm text-gray-500">Why smart ventilation matters for every generation</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-4 border border-blue-100">
            <span className="text-2xl">👴</span>
            <h4 className="font-medium text-gray-800 mt-2">Seniors</h4>
            <p className="text-sm text-gray-500 mt-1">
              Mold and poor air quality disproportionately affect older adults with respiratory conditions. 
              Smart ventilation reduces hospital visits and improves quality of life.
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-blue-100">
            <span className="text-2xl">👶</span>
            <h4 className="font-medium text-gray-800 mt-2">Children</h4>
            <p className="text-sm text-gray-500 mt-1">
              Children breathe 50% more air per kg of body weight than adults. 
              Reducing indoor mold and CO₂ buildup protects developing lungs.
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-blue-100">
            <span className="text-2xl">💰</span>
            <h4 className="font-medium text-gray-800 mt-2">Low-Income Households</h4>
            <p className="text-sm text-gray-500 mt-1">
              Energy poverty affects 1 in 5 Canadian households. Goldilocks helps reduce 
              heating costs while maintaining healthy indoor environments.
            </p>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-4">
          Kingston&apos;s Golden Age initiative recognizes that sustainable cities must work for everyone — 
          from the youngest to the oldest residents. Goldilocks bridges the gap between 
          environmental responsibility and accessible, healthy living.
        </p>
      </div>
    </div>
  );
}
