import "server-only";
import { verifySession } from "@/lib/dal/session";
import { assertAdministrator, ForbiddenError } from "@/lib/dal/authz";
import { traccarFetch } from "@/lib/traccar/client";
import { toDeviceDto, type DeviceDTO } from "@/lib/traccar/dto";
import type { TraccarDevice } from "@/lib/traccar/types";

export async function listDevices(): Promise<DeviceDTO[]> {
  const session = await verifySession();
  const devices = await traccarFetch<TraccarDevice[]>(session.traccarSessionId, "/api/devices");
  return devices.map(toDeviceDto);
}

// Traccar already filters /api/devices to what the session may see --
// membership in that list IS the per-device authorization check. Used by
// trips (lib/dal/trips.ts) and route history (lib/dal/positions.ts).
export async function assertDeviceVisible(deviceId: number): Promise<void> {
  const devices = await listDevices();
  if (!devices.some((d) => d.id === deviceId)) throw new ForbiddenError();
}

export type DeviceInput = {
  name: string;
  uniqueId: string;
  category: string | null;
  disabled: boolean;
};

export async function createDevice(input: DeviceInput): Promise<DeviceDTO> {
  const session = await verifySession();
  assertAdministrator(session);
  const created = await traccarFetch<TraccarDevice>(session.traccarSessionId, "/api/devices", {
    method: "POST",
    body: input,
  });
  return toDeviceDto(created);
}

async function fetchRawDevice(traccarSessionId: string, id: number): Promise<TraccarDevice> {
  const devices = await traccarFetch<TraccarDevice[]>(traccarSessionId, "/api/devices");
  const device = devices.find((d) => d.id === id);
  if (!device) throw new Error(`Traccar device ${id} not found`);
  return device;
}

// Traccar's PUT is a full replace, so we fetch-then-merge to avoid wiping
// fields we don't manage (attributes, groupId, calendarId, geofenceIds, ...).
export async function updateDevice(id: number, input: Partial<DeviceInput>): Promise<DeviceDTO> {
  const session = await verifySession();
  assertAdministrator(session);
  const current = await fetchRawDevice(session.traccarSessionId, id);
  const merged: TraccarDevice = { ...current, ...input };
  const updated = await traccarFetch<TraccarDevice>(session.traccarSessionId, `/api/devices/${id}`, {
    method: "PUT",
    body: merged,
  });
  return toDeviceDto(updated);
}

export async function deleteDevice(id: number): Promise<void> {
  const session = await verifySession();
  assertAdministrator(session);
  await traccarFetch<void>(session.traccarSessionId, `/api/devices/${id}`, { method: "DELETE" });
}
