"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import {
  ATTRIBUTION,
  DARK_TILE_URL,
  LIGHT_TILE_URL,
  InvalidateSizeOnMount,
  useIsDarkMode,
} from "@/app/(dashboard)/map/map-support";
import { KNOTS_TO_KMH } from "@/lib/units";
import type { PositionDTO } from "@/lib/traccar/dto";

// Vivid enough to stand out on both light and dark MapTiler tiles, unlike the
// theme's near-black/near-white primary color.
const ROUTE_COLOR = "#2563eb";
// Warm contrast against the blue base line, for the selected segment.
const HIGHLIGHT_COLOR = "#f97316";

// The segment "belonging to" a clicked point: for any point except the last,
// that's the segment leading OUT to the next point (matching the arrow's own
// direction); the last point has no "next", so it's the segment leading IN
// from the point before it.
function highlightSegmentIndexes(index: number, length: number): [number, number] | null {
  if (length < 2) return null;
  if (index >= length - 1) return [length - 2, length - 1];
  return [index, index + 1];
}

function FitRouteBounds({ latlngs }: { latlngs: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40] });
    // Fit once for the loaded route; a new route is a new page navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);
  return null;
}

// Initial bearing (degrees, 0 = north) from one point to the next -- used to
// point every arrow at where the device went next, rather than Traccar's own
// `course` field (the instantaneous heading at that fix, which can differ
// slightly from the straight line to the next recorded point).
function bearingDegrees(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// Arrow pointing north at bearing 0, rotated to face the next position. No
// user text is interpolated, so no escaping concerns (unlike device-icon.tsx).
// Rotation is set via a CSS custom property rather than an inline transform
// so the hover rule in globals.css can compose a scale on top of it -- an
// inline `transform` would win over any stylesheet rule and make the hover
// scale a no-op.
function arrowIcon(bearingDeg: number): L.DivIcon {
  return L.divIcon({
    className: "route-arrow-icon",
    html: `<svg width="18" height="18" viewBox="0 0 22 22" class="route-arrow-svg" style="--bearing:${bearingDeg}deg"><path d="M11 3 L17 17 L11 13.5 L5 17 Z" fill="${ROUTE_COLOR}" stroke="white" stroke-width="1.5"/></svg>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function endpointIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: "route-endpoint-icon",
    html: `<span style="display:block;width:16px;height:16px;border-radius:9999px;background:${color};border:3px solid white;box-shadow:0 0 0 1px rgba(0,0,0,0.35)"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function RoutePointPopup({ deviceName, position }: { deviceName: string; position: PositionDTO }) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{deviceName}</span>
      <span>{new Date(position.fixTime).toLocaleString()}</span>
      <span>{position.address ?? "Address unavailable"}</span>
      <span>{Math.round(position.speed * KNOTS_TO_KMH)} km/h</span>
    </div>
  );
}

export function RouteMap({ deviceName, positions }: { deviceName: string; positions: PositionDTO[] }) {
  const isDark = useIsDarkMode();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const latlngs = useMemo(
    () => positions.map((p) => [p.latitude, p.longitude] as [number, number]),
    [positions],
  );

  const highlightPositions = useMemo(() => {
    if (selectedIndex === null) return null;
    const segment = highlightSegmentIndexes(selectedIndex, latlngs.length);
    return segment ? [latlngs[segment[0]], latlngs[segment[1]]] : null;
  }, [selectedIndex, latlngs]);

  // Bearing toward the next point, for every position except the endpoints
  // (which get their own distinct start/end markers instead of an arrow).
  const bearings = useMemo(() => {
    const result = new Map<number, number>();
    for (let i = 1; i < positions.length - 1; i++) {
      const curr = positions[i];
      const next = positions[i + 1];
      result.set(i, bearingDegrees(curr.latitude, curr.longitude, next.latitude, next.longitude));
    }
    return result;
  }, [positions]);

  const start = positions[0];
  const end = positions[positions.length - 1];

  return (
    // isolate for the same reason as live-map.tsx: Leaflet's internal
    // z-indexes must never outrank overlays elsewhere in the app.
    <div className="relative isolate h-full w-full">
      <MapContainer bounds={L.latLngBounds(latlngs)} className="h-full w-full" preferCanvas>
        <InvalidateSizeOnMount />
        <FitRouteBounds latlngs={latlngs} />
        <TileLayer url={isDark ? DARK_TILE_URL : LIGHT_TILE_URL} attribution={ATTRIBUTION} maxZoom={19} />

        <Polyline positions={latlngs} pathOptions={{ color: ROUTE_COLOR, weight: 4, opacity: 0.8 }} />
        {/* The segment "belonging to" whichever point was last clicked,
            drawn on top of the base line in a contrasting color. */}
        {highlightPositions && (
          <Polyline positions={highlightPositions} pathOptions={{ color: HIGHLIGHT_COLOR, weight: 6, opacity: 1 }} />
        )}

        {/* Every recorded point except the endpoints, uniformly an arrow
            facing the next position -- clickable, same details popup, and
            highlights its outgoing segment while its popup is open. */}
        {positions.map((position, i) => {
          const bearing = bearings.get(i);
          if (bearing === undefined) return null;
          return (
            <Marker
              key={position.id}
              position={[position.latitude, position.longitude]}
              icon={arrowIcon(bearing)}
              eventHandlers={{
                popupopen: () => setSelectedIndex(i),
                popupclose: () => setSelectedIndex((curr) => (curr === i ? null : curr)),
              }}
            >
              <Popup>
                <RoutePointPopup deviceName={deviceName} position={position} />
              </Popup>
            </Marker>
          );
        })}

        <Marker
          position={[start.latitude, start.longitude]}
          icon={endpointIcon("#22c55e")}
          eventHandlers={{
            popupopen: () => setSelectedIndex(0),
            popupclose: () => setSelectedIndex((curr) => (curr === 0 ? null : curr)),
          }}
        >
          <Popup>
            <RoutePointPopup deviceName={deviceName} position={start} />
          </Popup>
        </Marker>
        <Marker
          position={[end.latitude, end.longitude]}
          icon={endpointIcon("#ef4444")}
          eventHandlers={{
            popupopen: () => setSelectedIndex(positions.length - 1),
            popupclose: () =>
              setSelectedIndex((curr) => (curr === positions.length - 1 ? null : curr)),
          }}
        >
          <Popup>
            <RoutePointPopup deviceName={deviceName} position={end} />
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
