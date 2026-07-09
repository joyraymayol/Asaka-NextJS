"use client";

import dynamic from "next/dynamic";
import type { PositionDTO } from "@/lib/traccar/dto";

// Same reason as map/map-view.tsx: Leaflet touches `window` at module-eval
// time, so it must never be server-rendered even though this is already a
// Client Component.
const RouteMap = dynamic(() => import("./route-map").then((m) => m.RouteMap), { ssr: false });

export function RouteMapView(props: { deviceName: string; positions: PositionDTO[] }) {
  return <RouteMap {...props} />;
}
