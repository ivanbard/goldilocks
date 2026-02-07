export default function ElectricityPriceChip({ electricity }) {
  if (!electricity) return null;

  const { price_cents_per_kWh, periodLabel, planType, season } = electricity;

  // Color based on rate
  let chipColor = 'badge-green';
  if (price_cents_per_kWh >= 15) chipColor = 'badge-red';
  else if (price_cents_per_kWh >= 10) chipColor = 'badge-yellow';

  return (
    <div className="card">
      <h3 className="card-title">Electricity Price</h3>
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">⚡</span>
            <span className={`badge ${chipColor}`}>
              {periodLabel}
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            {price_cents_per_kWh.toFixed(1)}¢<span className="text-sm font-normal text-gray-500">/kWh</span>
          </p>
        </div>
        <div className="text-right text-sm text-gray-500">
          <p>Plan: {planType}</p>
          <p className="capitalize">{season}</p>
        </div>
      </div>
    </div>
  );
}
