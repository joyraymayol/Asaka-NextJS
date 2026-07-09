"use client";

// Shared by the live map (live-map.tsx) and the route-history map
// (app/(dashboard)/routes/route-map.tsx): tile URLs, dark-mode tracking, and
// the container-resize fix. Everything here assumes it only ever runs in the
// browser -- both consumers are loaded via next/dynamic({ ssr: false }).

import { useEffect, useState } from "react";
import { useMap } from "react-leaflet";

// MapTiler "bright" (OSM-data-based, same open-source attribution requirement
// as before): unlike CARTO Voyager, this style actually renders business/
// building POI name labels at high zoom, not just streets and address
// numbers -- confirmed by comparing raw tiles from both providers at the same
// real-world coordinates. "bright" specifically (not "streets", which has the
// same labels but a much yellower palette, or "basic"/"dataviz"/"positron",
// which are whiter but drop the POI labels entirely). Requires a free API
// key (no card): https://cloud.maptiler.com/account/keys/
const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_API_KEY;
export const LIGHT_TILE_URL = `https://api.maptiler.com/maps/bright-v2/256/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`;
export const DARK_TILE_URL = `https://api.maptiler.com/maps/bright-v2-dark/256/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`;
export const ATTRIBUTION =
  '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Mirrors the dark/light state components/theme-toggle.tsx maintains (a
// plain `.dark` class on <html>, no theme context/provider exists). Watching
// the class directly here -- rather than adding a shared context -- keeps
// the tile-layer swap self-contained and reacts to the toggle regardless of
// where it's triggered from.
export function useIsDarkMode(): boolean {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => setIsDark(root.classList.contains("dark")));
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

// react-leaflet mounts MapContainer as soon as its wrapper div exists, which
// can race a flex/absolute layout that hasn't finished sizing yet, leaving
// Leaflet's internal size cache stale (classic "blank map" symptom). A
// ResizeObserver on the container (rather than a window "resize" listener)
// also catches layout-only size changes with no window resize event, e.g.
// the dashboard sidebar collapsing/expanding and animating the map's width.
export function InvalidateSizeOnMount() {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}
