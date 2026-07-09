import { verifySession } from "@/lib/dal/session";
import { listDevices } from "@/lib/dal/devices";
import { countActiveTrips } from "@/lib/dal/trips";
import { DeviceFormDialog } from "./device-form-dialog";
import { DevicesTable } from "./devices-table";
import type { DeviceRow } from "./columns";

export default async function DevicesPage() {
  const session = await verifySession();
  const [devices, activeTripCounts] = await Promise.all([listDevices(), countActiveTrips()]);

  const rows: DeviceRow[] = devices.map((device) => ({
    ...device,
    activeTripCount: activeTripCounts[device.id] ?? 0,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">Devices</h1>
        {session.administrator && <DeviceFormDialog />}
      </div>
      <DevicesTable data={rows} isAdmin={session.administrator} />
    </div>
  );
}
