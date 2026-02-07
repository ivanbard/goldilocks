import { useColorblindMode, getDeltaColors } from '../lib/ColorblindContext';

export default function IndoorOutdoorComparison({ indoor, outdoor, location }) {
  const { colorblindMode } = useColorblindMode();
  const formatTemp = (t) => t != null ? `${t.toFixed(1)}°C` : '—';
  const formatHumidity = (h) => h != null ? `${h.toFixed(0)}%` : 'N/A';
  const formatPressure = (p) => p != null ? `${p.toFixed(0)} hPa` : '—';

  // Delta calculation
  const hasBoth = indoor?.temp_C != null && outdoor?.temp_C != null;
  const deltaT = hasBoth ? (indoor.temp_C - outdoor.temp_C).toFixed(1) : null;
  const deltaSign = deltaT > 0 ? '+' : '';

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="card-title mb-0">Indoor vs Outdoor</h3>
        {deltaT != null && (
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${getDeltaColors(deltaT, colorblindMode)}`}>
            ΔT {deltaSign}{deltaT}°C
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {/* Indoor */}
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🏠</span>
            <span className="text-sm font-medium text-gray-600">Indoor</span>
            {indoor?.sensorOnline ? (
              <span className="w-2 h-2 rounded-full ml-auto" style={{ backgroundColor: 'var(--color-sensor-online)' }} title="Sensor online" />
            ) : (
              <span className="w-2 h-2 bg-red-400 rounded-full ml-auto" title="Sensor offline" />
            )}
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-3xl font-bold text-gray-900">{formatTemp(indoor?.temp_C)}</p>
              <p className="text-xs text-gray-500">Temperature</p>
            </div>
            <div className="flex gap-4">
              <div>
                <p className="text-lg font-semibold text-gray-800">{formatHumidity(indoor?.humidity_RH)}</p>
                <p className="text-xs text-gray-500">
                  Humidity{indoor?.humidity_estimated && <span className="text-amber-500 ml-1" title={`Estimated (${indoor.humidity_confidence} confidence)`}>~est</span>}
                </p>
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-800">{formatPressure(indoor?.pressure_hPa)}</p>
                <p className="text-xs text-gray-500">Pressure</p>
              </div>
            </div>
          </div>
        </div>

        {/* Outdoor */}
        <div className="bg-amber-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🌤️</span>
            <span className="text-sm font-medium text-gray-600">Outdoor</span>
            <span className="text-xs text-gray-400 ml-auto">{location || 'Loading...'}</span>
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-3xl font-bold text-gray-900">{formatTemp(outdoor?.temp_C)}</p>
              {outdoor?.feels_like_C != null && (
                <p className="text-xs text-gray-500">Feels like {outdoor.feels_like_C.toFixed(1)}°C</p>
              )}
            </div>
            <div className="flex gap-4">
              <div>
                <p className="text-lg font-semibold text-gray-800">{formatHumidity(outdoor?.humidity_RH)}</p>
                <p className="text-xs text-gray-500">Humidity</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 capitalize">{outdoor?.description || '—'}</p>
                <p className="text-xs text-gray-500">
                  {outdoor?.wind_speed_ms != null ? `💨 ${outdoor.wind_speed_ms.toFixed(1)} m/s` : 'Conditions'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
