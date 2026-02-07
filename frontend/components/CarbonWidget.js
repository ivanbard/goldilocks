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
    <div className="rounded-xl border eco-border eco-bg p-4" style={{ borderColor: 'var(--color-eco-border)', backgroundColor: 'var(--color-eco-bg)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🌍</span>
          <h3 className="font-semibold text-gray-900 text-sm">Carbon Impact</h3>
        </div>
        <Link href="/carbon" className="text-xs font-medium" style={{ color: 'var(--color-eco-text-light)' }}>
          View details →
        </Link>
      </div>
      
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-xl font-bold" style={{ color: 'var(--color-eco-text)' }}>{totalKg.toFixed(2)}</p>
          <p className="text-xs text-gray-500">kg CO₂ saved</p>
        </div>
        <div>
          <p className="text-xl font-bold" style={{ color: 'var(--color-eco-text)' }}>{todayG.toFixed(0)}g</p>
          <p className="text-xs text-gray-500">saved today</p>
        </div>
        <div>
          <p className="text-xl font-bold" style={{ color: 'var(--color-eco-text)' }}>{trees}</p>
          <p className="text-xs text-gray-500">🌳 trees eq.</p>
        </div>
      </div>
      
      {community > 0 && (
        <div className="mt-3 pt-3" style={{ borderTopWidth: 1, borderTopColor: 'var(--color-eco-border)' }}>
          <p className="text-xs" style={{ color: 'var(--color-eco-text-light)' }}>
            <span className="font-medium">🏘️ Kingston projection:</span> {community.toLocaleString()} tonnes CO₂/year 
            if all households adopted Goldilocks
          </p>
        </div>
      )}
    </div>
  );
}
