"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { useLiveFeed } from "@/lib/hooks/useLiveFeed";
import type { DeviceDTO, PositionDTO } from "@/lib/traccar/dto";
import { DevicePopupContent } from "./device-popup-content";

// CARTO Voyager: OSM-data-based (open source requirement) but far more
// polished/legible than raw tile.openstreetmap.org for layering markers,
// geofences, and paths on top.
const TILE_URL = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

const DEFAULT_CENTER: [number, number] = [0, 0];
const DEFAULT_ZOOM = 3;

function statusColor(status: DeviceDTO["status"]): string {
  if (status === "online") return "#22c55e";
  if (status === "offline") return "#9ca3af";
  return "#f59e0b";
}

function markerIcon(status: DeviceDTO["status"]) {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:14px;height:14px;border-radius:9999px;background:${statusColor(status)};border:2px solid white;box-shadow:0 0 0 1px rgba(0,0,0,0.25)"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

// react-leaflet mounts MapContainer as soon as its wrapper div exists, which
// can race a flex/absolute layout that hasn't finished sizing yet, leaving
// Leaflet's internal size cache stale (classic "blank map" symptom). Force a
// recompute once after mount and on every resize.
function InvalidateSizeOnMount() {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    const onResize = () => map.invalidateSize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [map]);
  return null;
}

export function LiveMap({
  initialDevices,
  initialPositions,
}: {
  initialDevices: DeviceDTO[];
  initialPositions: PositionDTO[];
}) {
  const { devices, positions, connected } = useLiveFeed(initialDevices, initialPositions);

  const markers = useMemo(() => {
    return Object.values(devices)
      .map((device) => ({ device, position: positions[device.id] }))
      .filter((entry): entry is { device: DeviceDTO; position: PositionDTO } => Boolean(entry.position));
  }, [devices, positions]);

  const center = markers[0]
    ? ([markers[0].position.latitude, markers[0].position.longitude] as [number, number])
    : DEFAULT_CENTER;

  return (
    <div className="relative h-full w-full">
      <div className="bg-background/90 absolute top-3 right-3 z-1000 rounded-md border px-3 py-1.5 text-xs shadow-sm">
        {connected ? "Live" : "Reconnecting…"} · {markers.length} of {Object.keys(devices).length} devices with a
        known position
      </div>
      <MapContainer center={center} zoom={markers[0] ? 12 : DEFAULT_ZOOM} className="h-full w-full">
        <InvalidateSizeOnMount />
        <TileLayer url={TILE_URL} attribution={ATTRIBUTION} />
        {markers.map(({ device, position }) => (
          <Marker
            key={device.id}
            position={[position.latitude, position.longitude]}
            icon={markerIcon(device.status)}
          >
            <Popup>
              <DevicePopupContent device={device} position={position} />
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
