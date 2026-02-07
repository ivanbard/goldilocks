export default function IndoorOutdoorComparison({ indoor, outdoor, location }) {
  const formatTemp = (t) => t != null ? `${t.toFixed(1)}°C` : '—';
  const formatHumidity = (h) => h != null ? `${h.toFixed(0)}%` : 'N/A';
  const formatPressure = (p) => p != null ? `${p.toFixed(0)} hPa` : '—';

  return (
    <div className="card">
      <h3 className="card-title">Indoor vs Outdoor</h3>
      <div className="grid grid-cols-2 gap-4">
        {/* Indoor */}
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🏠</span>
            <span className="text-sm font-medium text-gray-600">Indoor</span>
            {indoor?.sensorOnline ? (
              <span className="w-2 h-2 bg-green-400 rounded-full ml-auto" title="Sensor online" />
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
              <p className="text-xs text-gray-500">Temperature</p>
            </div>
            <div className="flex gap-4">
              <div>
                <p className="text-lg font-semibold text-gray-800">{formatHumidity(outdoor?.humidity_RH)}</p>
                <p className="text-xs text-gray-500">Humidity</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 capitalize">{outdoor?.description || '—'}</p>
                <p className="text-xs text-gray-500">Conditions</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
