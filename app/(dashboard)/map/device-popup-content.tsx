import type { DeviceDTO, PositionDTO } from "@/lib/traccar/dto";

// Traccar reports speed in knots.
const KNOTS_TO_KMH = 1.852;

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
    </div>
  );
}
