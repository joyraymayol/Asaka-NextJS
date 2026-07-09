"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import { useLiveFeed } from "@/lib/hooks/useLiveFeed";
import type { DeviceDTO, PositionDTO } from "@/lib/traccar/dto";
import { DeviceMarker } from "./device-marker";

// MapTiler "bright" (OSM-data-based, same open-source attribution requirement
// as before): unlike CARTO Voyager, this style actually renders business/
// building POI name labels at high zoom, not just streets and address
// numbers -- confirmed by comparing raw tiles from both providers at the same
// real-world coordinates. "bright" specifically (not "streets", which has the
// same labels but a much yellower palette, or "basic"/"dataviz"/"positron",
// which are whiter but drop the POI labels entirely). Requires a free API
// key (no card): https://cloud.maptiler.com/account/keys/
const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_API_KEY;
const LIGHT_TILE_URL = `https://api.maptiler.com/maps/bright-v2/256/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`;
const DARK_TILE_URL = `https://api.maptiler.com/maps/bright-v2-dark/256/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`;
const ATTRIBUTION =
  '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Mirrors the dark/light state components/theme-toggle.tsx maintains (a
// plain `.dark` class on <html>, no theme context/provider exists). Watching
// the class directly here -- rather than adding a shared context -- keeps
// the tile-layer swap self-contained and reacts to the toggle regardless of
// where it's triggered from.
function useIsDarkMode(): boolean {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => setIsDark(root.classList.contains("dark")));
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

const DEFAULT_CENTER: [number, number] = [0, 0];
const DEFAULT_ZOOM = 3;

// react-leaflet mounts MapContainer as soon as its wrapper div exists, which
// can race a flex/absolute layout that hasn't finished sizing yet, leaving
// Leaflet's internal size cache stale (classic "blank map" symptom). A
// ResizeObserver on the container (rather than a window "resize" listener)
// also catches layout-only size changes with no window resize event, e.g.
// the dashboard sidebar collapsing/expanding and animating the map's width.
function InvalidateSizeOnMount() {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
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
  const isDark = useIsDarkMode();
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);

  const markers = useMemo(() => {
    return Object.values(devices)
      .map((device) => ({ device, position: positions[device.id] }))
      .filter((entry): entry is { device: DeviceDTO; position: PositionDTO } => Boolean(entry.position));
  }, [devices, positions]);

  const center = markers[0]
    ? ([markers[0].position.latitude, markers[0].position.longitude] as [number, number])
    : DEFAULT_CENTER;

  return (
    // isolate: Leaflet's internal z-indexes (zoom controls, and our own
    // .device-marker-icon-selected at z-index 10000) must never leak out and
    // outrank unrelated overlays elsewhere in the app -- e.g. the mobile
    // sidebar Sheet (components/ui/sheet.tsx), which portals to <body> at
    // z-index 50. Without isolate, this div has no stacking context of its
    // own, so those z-indexes compete directly against the Sheet's and win.
    <div className="relative isolate h-full w-full">
      <div className="bg-background/90 absolute top-3 right-3 z-1000 rounded-md border px-3 py-1.5 text-xs shadow-sm">
        {connected ? "Live" : "Reconnecting…"} · {markers.length} of {Object.keys(devices).length} devices with a
        known position
      </div>
      <MapContainer center={center} zoom={markers[0] ? 16 : DEFAULT_ZOOM} className="h-full w-full">
        <InvalidateSizeOnMount />
        <TileLayer url={isDark ? DARK_TILE_URL : LIGHT_TILE_URL} attribution={ATTRIBUTION} maxZoom={19} />
        {markers.map(({ device, position }) => (
          <DeviceMarker
            key={device.id}
            device={device}
            position={position}
            isSelected={device.id === selectedDeviceId}
            onSelect={() => setSelectedDeviceId(device.id)}
            onDeselect={() => setSelectedDeviceId((current) => (current === device.id ? null : current))}
          />
        ))}
      </MapContainer>
    </div>
  );
}
