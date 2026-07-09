"use client";

import "leaflet/dist/leaflet.css";
import { useMemo, useState } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import { useLiveFeed } from "@/lib/hooks/useLiveFeed";
import type { DeviceDTO, PositionDTO } from "@/lib/traccar/dto";
import { DeviceMarker } from "./device-marker";
import {
  ATTRIBUTION,
  DARK_TILE_URL,
  LIGHT_TILE_URL,
  InvalidateSizeOnMount,
  useIsDarkMode,
} from "./map-support";

const DEFAULT_CENTER: [number, number] = [0, 0];
const DEFAULT_ZOOM = 3;

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
