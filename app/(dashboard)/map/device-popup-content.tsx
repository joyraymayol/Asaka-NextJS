import { Button } from "@/components/ui/button";
import { TripsDialog } from "@/app/(dashboard)/devices/trips-dialog";
import { RouteDialog } from "@/app/(dashboard)/devices/route-dialog";
import { KNOTS_TO_KMH } from "@/lib/units";
import type { DeviceDTO, PositionDTO } from "@/lib/traccar/dto";

export function DevicePopupContent({
  device,
  position,
}: {
  device: DeviceDTO;
  position: PositionDTO;
}) {
  const time = new Date(position.fixTime).toLocaleString();
  const speedKmh = Math.round(position.speed * KNOTS_TO_KMH);

  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{device.name}</span>
      <span>{time}</span>
      <span>{position.address ?? "Address unavailable"}</span>
      <span>{speedKmh} km/h</span>
      <div className="mt-1 grid grid-cols-2 gap-1.5">
        {/* Both portal to <body>, so opening a dialog from inside a Leaflet
            popup is fine -- and it escapes the map's isolated stacking
            context the same way the mobile sidebar Sheet does. */}
        <TripsDialog
          deviceId={device.id}
          deviceName={device.name}
          trigger={<Button variant="outline" size="sm" className="w-full" />}
          triggerLabel="Trips"
        />
        <RouteDialog
          deviceId={device.id}
          deviceName={device.name}
          trigger={<Button variant="outline" size="sm" className="w-full" />}
        />
      </div>
    </div>
  );
}
