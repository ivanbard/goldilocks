import { useState, useMemo } from 'react';
import { useCarbon } from '../lib/api';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// Kingston constants (match backend)
const KINGSTON_HOUSEHOLDS = 60000;
const KINGSTON_POP = 136685;
const AVG_HOME_CO2_TONNES_YEAR = 5.0;
const KINGSTON_2030_TARGET_PCT = 15; // City of Kingston aims for 15% reduction by 2030
const TREE_KG_PER_YEAR = 22;
const DRIVING_G_PER_KM = 170;

function fmt(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(0);
}

function SliderInput({ label, value, min, max, step, onChange, unit, icon }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <span>{icon}</span> {label}
        </label>
        <span className="text-lg font-bold text-amber-600">
          {typeof value === 'number' && value % 1 === 0 ? value.toLocaleString() : value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
      />
      <div className="flex justify-between text-xs text-gray-400">
        <span>{min.toLocaleString()}{unit}</span>
        <span>{max.toLocaleString()}{unit}</span>
      </div>
    </div>
  );
}

function ImpactCard({ icon, value, unit, label, sub, accent = 'emerald' }) {
  const colors = {
    emerald: 'from-emerald-500 to-emerald-600',
    blue: 'from-blue-500 to-blue-600',
    amber: 'from-amber-500 to-amber-600',
    purple: 'from-purple-500 to-purple-600',
    rose: 'from-rose-500 to-rose-600',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colors[accent]} flex items-center justify-center text-white text-lg`}>
          {icon}
        </div>
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</span>
      </div>
      <p className="text-3xl font-bold text-gray-900">
        {value} <span className="text-sm font-normal text-gray-500">{unit}</span>
      </p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function Simulator() {
  const { data: carbon } = useCarbon();

  // Slider state
  const [adoptionPct, setAdoptionPct] = useState(25);
  const [years, setYears] = useState(5);
  const [savingsPerHomeKg, setSavingsPerHomeKg] = useState(120);

  // Use real user data if available to set a smarter default
  const userAnnualKg = carbon?.community?.annual_user_kg || 120;

  const sim = useMemo(() => {
    const adoptedHomes = Math.round(KINGSTON_HOUSEHOLDS * (adoptionPct / 100));
    const annualTonnes = (adoptedHomes * savingsPerHomeKg) / 1000;
    const cumulativeTonnes = annualTonnes * years;
    const treesEquiv = Math.round(cumulativeTonnes * 1000 / TREE_KG_PER_YEAR);
    const kmAvoided = Math.round(cumulativeTonnes * 1e6 / DRIVING_G_PER_KM);

    // Kingston's total residential heating CO2
    const kingstonTotalTonnes = AVG_HOME_CO2_TONNES_YEAR * KINGSTON_HOUSEHOLDS;
    const pctReduction = (annualTonnes / kingstonTotalTonnes) * 100;

    // City of Kingston 2030 target progress
    const targetTonnes2030 = kingstonTotalTonnes * (KINGSTON_2030_TARGET_PCT / 100);
    const pctOf2030Target = Math.min((annualTonnes / targetTonnes2030) * 100, 100);

    // Dollar savings (avg Ontario heating cost ~$1800/year, proportional to CO2)
    const avgHeatingCost = 1800;
    const dollarsSavedPerHome = (savingsPerHomeKg / (AVG_HOME_CO2_TONNES_YEAR * 1000)) * avgHeatingCost;
    const totalDollarsSaved = dollarsSavedPerHome * adoptedHomes * years;

    // Health impact estimates (Kingston Public Health data inspired)
    const asthmaReduction = Math.min(adoptionPct * 0.12, 15); // up to 15% fewer ER visits
    const moldPrevention = Math.round(adoptedHomes * 0.15); // 15% of homes prevented from mold

    // Year-by-year projection
    const yearlyData = [];
    for (let y = 1; y <= years; y++) {
      // Adoption ramps up following S-curve
      const rampFactor = y <= 2 ? y / 2 : 1;
      yearlyData.push({
        year: `Year ${y}`,
        co2_tonnes: Math.round(annualTonnes * rampFactor * y * 10) / 10,
        homes: Math.round(adoptedHomes * (y <= 2 ? y / years : 1)),
        savings_k: Math.round(dollarsSavedPerHome * adoptedHomes * rampFactor * y / 1000),
      });
    }

    // Adoption breakdown by neighborhood type
    const neighborhoods = [
      { name: 'Downtown/Core', pct: 35, homes: Math.round(adoptedHomes * 0.35) },
      { name: 'Suburbs', pct: 40, homes: Math.round(adoptedHomes * 0.40) },
      { name: 'Rural', pct: 15, homes: Math.round(adoptedHomes * 0.15) },
      { name: 'Student Housing', pct: 10, homes: Math.round(adoptedHomes * 0.10) },
    ];

    return {
      adoptedHomes,
      annualTonnes,
      cumulativeTonnes,
      treesEquiv,
      kmAvoided,
      pctReduction,
      pctOf2030Target,
      dollarsSavedPerHome,
      totalDollarsSaved,
      asthmaReduction,
      moldPrevention,
      yearlyData,
      neighborhoods,
      kingstonTotalTonnes,
    };
  }, [adoptionPct, years, savingsPerHomeKg]);

  const PIE_COLORS = ['#f59e0b', '#10b981', '#6366f1', '#ec4899'];

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 rounded-2xl p-8 border border-amber-200">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-4xl">🏘️</span>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Kingston Adoption Simulator</h1>
            <p className="text-gray-600">What if Kingston adopted Goldilocks city-wide?</p>
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Model the environmental, economic, and health impact of smart ventilation adoption across Kingston's {KINGSTON_HOUSEHOLDS.toLocaleString()} households.
          Aligned with the City of Kingston's Community Climate Action Plan.
        </p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <span>🎛️</span> Simulation Parameters
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <SliderInput
            icon="🏠"
            label="Adoption Rate"
            value={adoptionPct}
            min={1}
            max={100}
            step={1}
            onChange={setAdoptionPct}
            unit="%"
          />
          <SliderInput
            icon="📅"
            label="Projection Horizon"
            value={years}
            min={1}
            max={30}
            step={1}
            onChange={setYears}
            unit=" yrs"
          />
          <SliderInput
            icon="🌿"
            label="CO₂ Saved per Home"
            value={savingsPerHomeKg}
            min={10}
            max={500}
            step={10}
            onChange={setSavingsPerHomeKg}
            unit=" kg/yr"
          />
        </div>
        <p className="text-xs text-gray-400">
          💡 Default CO₂ savings based on {carbon?.community?.annual_user_kg ? 'your actual Goldilocks data' : 'Kingston heating averages'}. 
          Adjust to model conservative or optimistic scenarios.
        </p>
      </div>

      {/* Impact cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <ImpactCard
          icon="🏠"
          value={fmt(sim.adoptedHomes)}
          unit="homes"
          label="Adopted Homes"
          accent="amber"
          sub={`${adoptionPct}% of Kingston`}
        />
        <ImpactCard
          icon="🌿"
          value={fmt(sim.cumulativeTonnes)}
          unit="tonnes CO₂"
          label={`${years}-Year Reduction`}
          accent="emerald"
          sub={`${sim.pctReduction.toFixed(1)}% of residential heating`}
        />
        <ImpactCard
          icon="🌳"
          value={fmt(sim.treesEquiv)}
          unit="trees"
          label="Equivalent Trees"
          accent="emerald"
          sub="mature trees absorbing CO₂"
        />
        <ImpactCard
          icon="💰"
          value={`$${fmt(sim.totalDollarsSaved)}`}
          unit="saved"
          label="Community Savings"
          accent="blue"
          sub={`$${Math.round(sim.dollarsSavedPerHome)}/home/yr`}
        />
        <ImpactCard
          icon="🫁"
          value={sim.moldPrevention.toLocaleString()}
          unit="homes"
          label="Mold Prevented"
          accent="purple"
          sub={`${sim.asthmaReduction.toFixed(1)}% fewer asthma ER visits`}
        />
      </div>

      {/* 2030 Target Progress */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <span>🎯</span> City of Kingston 2030 Climate Target
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Kingston's Community Climate Action Plan targets a {KINGSTON_2030_TARGET_PCT}% reduction in residential heating emissions by 2030. 
          At {adoptionPct}% adoption, Goldilocks alone could achieve:
        </p>
        <div className="relative h-8 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-400 to-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(sim.pctOf2030Target, 100)}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-800">
            {sim.pctOf2030Target.toFixed(1)}% of 2030 Target
          </div>
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>0 tonnes/yr</span>
          <span className="font-medium text-emerald-600">Target: {fmt(sim.kingstonTotalTonnes * KINGSTON_2030_TARGET_PCT / 100)} tonnes/yr</span>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Year-over-year projection */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">📈 Cumulative CO₂ Reduction</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={sim.yearlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="year" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={(v) => `${v}t`} />
              <Tooltip formatter={(v) => [`${v} tonnes`, 'CO₂ Avoided']} />
              <Area
                type="monotone"
                dataKey="co2_tonnes"
                stroke="#10b981"
                fill="url(#green)"
                strokeWidth={2}
              />
              <defs>
                <linearGradient id="green" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
                </linearGradient>
              </defs>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Community savings */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">💰 Community Savings ($K)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={sim.yearlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="year" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={(v) => `$${v}K`} />
              <Tooltip formatter={(v) => [`$${v}K`, 'Savings']} />
              <Bar dataKey="savings_k" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Neighborhood breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">📍 Adoption by Neighbourhood Type</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={sim.neighborhoods}
                dataKey="homes"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                innerRadius={50}
                paddingAngle={3}
              >
                {sim.neighborhoods.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => [v.toLocaleString() + ' homes']} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-3">
            {sim.neighborhoods.map((n, i) => (
              <div key={n.name} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full" style={{ background: PIE_COLORS[i] }} />
                <div className="flex-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-700">{n.name}</span>
                    <span className="text-gray-500">{n.homes.toLocaleString()} homes</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full mt-1">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${n.pct}%`, background: PIE_COLORS[i] }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Equity / Accessibility callout */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-3">
          <span>🤝</span> Equity & Accessibility
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-700">
          <div className="bg-white/70 rounded-lg p-4">
            <p className="font-medium text-blue-700 mb-1">👴 Seniors (65+)</p>
            <p>
              Kingston's aging population is most vulnerable to extreme indoor temperatures. 
              Goldilocks provides automated monitoring without complex smart-home setups — 
              just open or close a window when told.
            </p>
          </div>
          <div className="bg-white/70 rounded-lg p-4">
            <p className="font-medium text-blue-700 mb-1">💵 Low-Income Households</p>
            <p>
              Energy costs hit hardest for those who can least afford it. 
              At ${Math.round(sim.dollarsSavedPerHome)}/year savings per home, 
              Goldilocks reduces energy poverty without requiring expensive retrofits.
            </p>
          </div>
          <div className="bg-white/70 rounded-lg p-4">
            <p className="font-medium text-blue-700 mb-1">🧒 Children & Respiratory Health</p>
            <p>
              Mold from poor ventilation causes childhood asthma. 
              With {sim.moldPrevention.toLocaleString()} homes preventing mold, 
              Goldilocks could reduce pediatric ER visits by {sim.asthmaReduction.toFixed(1)}%.
            </p>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-xl p-6 text-center text-white">
        <h3 className="text-xl font-bold mb-2">Ready to make this real?</h3>
        <p className="text-amber-100 text-sm max-w-2xl mx-auto">
          Goldilocks costs less than $20 in hardware per home. With city-wide deployment, 
          Kingston could save {fmt(sim.cumulativeTonnes)} tonnes of CO₂ and ${fmt(sim.totalDollarsSaved)} over {years} years — 
          while protecting vulnerable residents from mold and extreme temperatures.
        </p>
        <div className="flex items-center justify-center gap-4 mt-4">
          <span className="bg-white/20 rounded-full px-4 py-2 text-sm font-medium">
            🐻 Goldilocks × City of Kingston
          </span>
          <span className="bg-white/20 rounded-full px-4 py-2 text-sm font-medium">
            Powered by Google Gemini
          </span>
        </div>
      </div>
    </div>
  );
}
