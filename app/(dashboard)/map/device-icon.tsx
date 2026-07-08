import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import L from "leaflet";
import { Car, CarFront, Truck, Van, Motorbike, Bus, Mountain, type LucideIcon } from "lucide-react";
import type { DeviceDTO } from "@/lib/traccar/dto";

// Lucide has no exact glyph for "pickup" or "offroad" -- CarFront and Mountain
// are the closest available substitutes (confirmed against installed icon set).
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  truck: Truck,
  car: Car,
  van: Van,
  motorcycle: Motorbike,
  trolleybus: Bus,
  pickup: CarFront,
  offroad: Mountain,
};

function categoryIcon(category: string | null): LucideIcon {
  if (!category) return Car;
  return CATEGORY_ICONS[category] ?? Car;
}

function statusColor(status: DeviceDTO["status"]): string {
  if (status === "online") return "#22c55e";
  if (status === "offline") return "#9ca3af";
  return "#f59e0b";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Icon + status-color badge only depends on (category, status) -- a small
// closed set (~7 categories x 3 statuses) -- so it's cached at module scope.
// useLiveFeed replaces the *entire* devices/positions record on every WS
// message, so without this every device would re-render its SVG on every
// tick even when only one device actually changed.
const badgeCache = new Map<string, string>();

function badgeMarkup(category: string | null, status: DeviceDTO["status"]): string {
  const Icon = categoryIcon(category);
  const svg = renderToStaticMarkup(createElement(Icon, { size: 15, strokeWidth: 2, color: "white" }));
  return `<span class="device-marker-badge" style="background:${statusColor(status)}">${svg}</span>`;
}

function getCachedBadgeMarkup(category: string | null, status: DeviceDTO["status"]): string {
  const key = `${category ?? ""}|${status}`;
  let markup = badgeCache.get(key);
  if (!markup) {
    markup = badgeMarkup(category, status);
    badgeCache.set(key, markup);
  }
  return markup;
}

export function deviceMarkerIcon(
  device: Pick<DeviceDTO, "name" | "category" | "status">,
  isSelected = false,
): L.DivIcon {
  const badge = getCachedBadgeMarkup(device.category, device.status);
  const label = `<span class="device-marker-label" style="background:var(--popover);color:var(--popover-foreground);border:1px solid var(--border)">${escapeHtml(device.name)}</span>`;
  return L.divIcon({
    className: isSelected ? "device-marker-icon device-marker-icon-selected" : "device-marker-icon",
    html: `<div class="device-marker">${label}${badge}</div>`,
    iconSize: [26, 48],
    iconAnchor: [13, 35],
  });
}
