"use client";

import dynamic from "next/dynamic";
import type { DeviceDTO, PositionDTO } from "@/lib/traccar/dto";

// Leaflet touches `window` at module-eval time, so it must never be
// server-rendered even though this is already a Client Component.
const LiveMap = dynamic(() => import("./live-map").then((m) => m.LiveMap), { ssr: false });

export function MapView(props: { initialDevices: DeviceDTO[]; initialPositions: PositionDTO[] }) {
  return <LiveMap {...props} />;
}
