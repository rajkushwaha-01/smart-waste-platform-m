import { useEffect, useMemo } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import { Link } from 'react-router-dom';
import { FILL_STATUS_MARKER_COLOR } from '../../utils/constants.js';
import { formatPercent, formatRelativeTime } from '../../utils/formatters.js';
import { EmptyState } from '../ui/States.jsx';

// Fallback center when there are no bins yet (or none with a location
// on record) — an arbitrary default view, not a fabricated data point.
const DEFAULT_CENTER = [23.2599, 77.4126];
const DEFAULT_ZOOM = 12;

function FitToBins({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], DEFAULT_ZOOM);
      return;
    }
    map.fitBounds(points, { padding: [32, 32] });
  }, [map, points]);
  return null;
}

export function BinsMap({ bins }) {
  const located = useMemo(
    () => (bins ?? []).filter((bin) => Number.isFinite(bin.location?.latitude) && Number.isFinite(bin.location?.longitude)),
    [bins],
  );
  const points = useMemo(
    () => located.map((bin) => [bin.location.latitude, bin.location.longitude]),
    [located],
  );

  if (located.length === 0) {
    return <EmptyState label="No bin locations to display" />;
  }

  return (
    <div className="overflow-hidden rounded-md border border-surface-700">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom
        style={{ height: 360, width: '100%', background: '#0b0f14' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <FitToBins points={points} />
        {located.map((bin) => (
          <CircleMarker
            key={bin.binId}
            center={[bin.location.latitude, bin.location.longitude]}
            radius={9}
            pathOptions={{
              color: FILL_STATUS_MARKER_COLOR[bin.fillStatus] ?? '#64748b',
              fillColor: FILL_STATUS_MARKER_COLOR[bin.fillStatus] ?? '#64748b',
              fillOpacity: 0.75,
              weight: 2,
            }}
          >
            <Popup>
              <div className="space-y-1 font-sans text-xs">
                <p className="font-semibold text-slate-900">{bin.binId}</p>
                <p>Fill level: {formatPercent(bin.currentFillLevel)}</p>
                <p>Priority: {bin.priority}</p>
                <p>Last seen: {formatRelativeTime(bin.lastTelemetryAt)}</p>
                <Link to={`/bins/${bin.binId}`} className="text-cyan-700 underline">
                  View details
                </Link>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
