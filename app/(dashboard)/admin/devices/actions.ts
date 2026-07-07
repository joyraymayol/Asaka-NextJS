"use server";

import { revalidatePath } from "next/cache";
import { createDevice, updateDevice, deleteDevice, type DeviceInput } from "@/lib/dal/devices";
import { ForbiddenError } from "@/lib/dal/authz";
import { TraccarRequestError } from "@/lib/traccar/client";

type ActionResult = { error?: string };

function toActionError(err: unknown): ActionResult {
  if (err instanceof ForbiddenError) return { error: err.message };
  if (err instanceof TraccarRequestError) return { error: `Traccar rejected the request (${err.status}).` };
  throw err;
}

export async function createDeviceAction(input: DeviceInput): Promise<ActionResult> {
  try {
    await createDevice(input);
    revalidatePath("/admin/devices");
    return {};
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateDeviceAction(id: number, input: Partial<DeviceInput>): Promise<ActionResult> {
  try {
    await updateDevice(id, input);
    revalidatePath("/admin/devices");
    return {};
  } catch (err) {
    return toActionError(err);
  }
}

export async function deleteDeviceAction(id: number): Promise<ActionResult> {
  try {
    await deleteDevice(id);
    revalidatePath("/admin/devices");
    return {};
  } catch (err) {
    return toActionError(err);
  }
}
