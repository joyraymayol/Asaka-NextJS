import { listDevices } from "@/lib/dal/devices";
import { listLatestPositions } from "@/lib/dal/positions";
import { MapView } from "./map-view";

export default async function MapPage() {
  const [devices, positions] = await Promise.all([listDevices(), listLatestPositions()]);

  return (
    <div className="absolute inset-0">
      <MapView initialDevices={devices} initialPositions={positions} />
    </div>
  );
}
