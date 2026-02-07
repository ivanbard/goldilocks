import { useCarbon } from '../lib/api';
import Link from 'next/link';

export default function CarbonWidget() {
  const { data } = useCarbon();

  const totalKg = data?.total?.co2_saved_kg || 0;
  const todayG = data?.today?.co2_saved_g || 0;
  const trees = data?.equivalences?.trees_equivalent || 0;
  const community = data?.community?.annual_community_tonnes || 0;
  const daysTracked = data?.total?.days_tracked || 0;

  return (
    <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🌍</span>
          <h3 className="font-semibold text-gray-900 text-sm">Carbon Impact</h3>
        </div>
        <Link href="/carbon" className="text-xs text-emerald-600 hover:text-emerald-800 font-medium">
          View details →
        </Link>
      </div>
      
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-xl font-bold text-emerald-700">{totalKg.toFixed(2)}</p>
          <p className="text-xs text-gray-500">kg CO₂ saved</p>
        </div>
        <div>
          <p className="text-xl font-bold text-emerald-700">{todayG.toFixed(0)}g</p>
          <p className="text-xs text-gray-500">saved today</p>
        </div>
        <div>
          <p className="text-xl font-bold text-emerald-700">{trees}</p>
          <p className="text-xs text-gray-500">🌳 trees eq.</p>
        </div>
      </div>
      
      {community > 0 && (
        <div className="mt-3 pt-3 border-t border-emerald-100">
          <p className="text-xs text-emerald-600">
            <span className="font-medium">🏘️ Kingston projection:</span> {community.toLocaleString()} tonnes CO₂/year 
            if all households adopted VentSmart
          </p>
        </div>
      )}
    </div>
  );
}
