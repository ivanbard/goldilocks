import { useDashboard } from '../lib/api';
import RecommendationCard from '../components/RecommendationCard';
import IndoorOutdoorComparison from '../components/IndoorOutdoorComparison';
import ElectricityPriceChip from '../components/ElectricityPriceChip';
import SavingsWidget from '../components/SavingsWidget';
import MoldRiskModule from '../components/MoldRiskModule';
import HumidityTimeline from '../components/HumidityTimeline';
import NotificationsPanel from '../components/NotificationsPanel';
import CarbonWidget from '../components/CarbonWidget';

export default function Dashboard() {
  const { data, error, isLoading } = useDashboard();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card bg-red-50 border-red-200">
        <p className="text-red-600 font-medium">Failed to load dashboard</p>
        <p className="text-sm text-red-500 mt-1">
          Make sure the backend is running on port 3001.
          Run <code className="bg-red-100 px-1 rounded">npm run dev:backend</code> from the project root.
        </p>
      </div>
    );
  }

  if (!data) return null;

  const { indoor, outdoor, electricity, recommendation, costEstimate, moldRisk, todaySavings, weather, furnaceFilterReminder, deviceId } = data;

  return (
    <div className="space-y-6">
      {/* Recommendation banner — hero card */}
      <RecommendationCard recommendation={recommendation} />

      {/* Furnace filter reminder */}
      {furnaceFilterReminder && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <span className="text-xl">🔧</span>
          <p className="text-sm text-amber-800">{furnaceFilterReminder.message}</p>
        </div>
      )}

      {/* Top row: Indoor/Outdoor + Electricity + Savings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <IndoorOutdoorComparison indoor={indoor} outdoor={outdoor} location={weather?.location} />
        </div>
        <div className="space-y-4">
          <ElectricityPriceChip electricity={electricity} />
        </div>
      </div>

      {/* Middle row: Savings + Mold Risk */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SavingsWidget costEstimate={costEstimate} todaySavings={todaySavings} />
        <MoldRiskModule moldRisk={moldRisk} />
      </div>

      {/* Carbon Impact Widget */}
      <CarbonWidget />

      {/* Humidity timeline chart */}
      <HumidityTimeline deviceId={deviceId} />

      {/* Forecast preview */}
      {weather && weather.forecast && weather.forecast.length > 0 && (
        <div className="card">
          <h3 className="card-title">Forecast (Next Hours)</h3>
          <div className="grid grid-cols-3 gap-3">
            {weather.forecast.map((f, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400">
                  {f.dt_txt ? new Date(f.dt_txt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : `+${(i + 1) * 3}h`}
                </p>
                <p className="text-lg font-semibold text-gray-800 mt-1">
                  {f.temp_C?.toFixed(0)}°C
                </p>
                <p className="text-sm text-gray-500 capitalize">{f.description}</p>
                {f.pop > 0 && (
                  <p className="text-xs text-blue-500 mt-1">🌧️ {(f.pop * 100).toFixed(0)}% rain</p>
                )}
              </div>
            ))}
          </div>
          {weather.mock && (
            <p className="text-xs text-gray-400 mt-2">⚠️ Using mock weather data. Set OPENWEATHERMAP_API_KEY in .env for real data.</p>
          )}
        </div>
      )}

      {/* Notifications */}
      <NotificationsPanel />

      {/* Status bar */}
      <div className="flex items-center justify-between text-xs text-gray-400 px-1">
        <span>
          {indoor?.sensorOnline
            ? `Sensor online — last reading ${indoor.lastUpdated ? new Date(indoor.lastUpdated).toLocaleTimeString() : 'N/A'}`
            : 'Sensor offline — showing cached data'
          }
        </span>
        <span>{data.readingsCount24h || 0} readings in last 24h</span>
      </div>
    </div>
  );
}
