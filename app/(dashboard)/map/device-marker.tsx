"use client";

import { useMemo } from "react";
import { Marker, Popup } from "react-leaflet";
import type { DeviceDTO, PositionDTO } from "@/lib/traccar/dto";
import { deviceMarkerIcon } from "./device-icon";
import { DevicePopupContent } from "./device-popup-content";

export function DeviceMarker({
  device,
  position,
  isSelected,
  onSelect,
  onDeselect,
}: {
  device: DeviceDTO;
  position: PositionDTO;
  isSelected: boolean;
  onSelect: () => void;
  onDeselect: () => void;
}) {
  // Memoized on identity/status/name/selection only -- deliberately NOT on
  // position. Every live position tick otherwise rebuilds a brand new
  // L.DivIcon, which makes react-leaflet call marker.setIcon(), which
  // destroys and recreates the marker's actual DOM element. A freshly
  // created element has no prior transform to animate from, so the
  // CSS transition on .device-marker-icon (app/globals.css) that's meant to
  // glide the marker from its old position to its new one would never have
  // anything to animate -- it'd just snap, silently defeated. Keeping the
  // icon object reference stable across position-only updates means
  // react-leaflet only calls marker.setLatLng() on the same element, which
  // the CSS transition can actually animate.
  // `device` itself is intentionally excluded so a position-only update (a
  // new `device` object reference with the same name/category/status)
  // doesn't invalidate the memo; see comment above.
  const icon = useMemo(
    () => deviceMarkerIcon(device, isSelected),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [device.category, device.status, device.name, isSelected],
  );

  return (
    <Marker
      position={[position.latitude, position.longitude]}
      icon={icon}
      eventHandlers={{ popupopen: onSelect, popupclose: onDeselect }}
    >
      <Popup>
        <DevicePopupContent device={device} position={position} />
      </Popup>
    </Marker>
  );
}
