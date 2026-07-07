import { listDevices } from "@/lib/dal/devices";
import { DeviceFormDialog } from "./device-form-dialog";
import { DevicesTable } from "./devices-table";

export default async function DevicesPage() {
  const devices = await listDevices();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">Devices</h1>
        <DeviceFormDialog />
      </div>
      <DevicesTable data={devices} />
    </div>
  );
}
