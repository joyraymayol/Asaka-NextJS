"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createDevice, updateDevice, deleteDevice, type DeviceInput } from "@/lib/dal/devices";
import {
  startTrip,
  stopTrip,
  refreshTripDistance,
  listTripsForDevice,
  type TripDTO,
} from "@/lib/dal/trips";
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
    revalidatePath("/devices");
    return {};
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateDeviceAction(id: number, input: Partial<DeviceInput>): Promise<ActionResult> {
  try {
    await updateDevice(id, input);
    revalidatePath("/devices");
    return {};
  } catch (err) {
    return toActionError(err);
  }
}

export async function deleteDeviceAction(id: number): Promise<ActionResult> {
  try {
    await deleteDevice(id);
    revalidatePath("/devices");
    return {};
  } catch (err) {
    return toActionError(err);
  }
}

// ---- Trips ----------------------------------------------------------------

const tripNameSchema = z
  .string()
  .trim()
  .min(1, "Trip name is required.")
  .max(80, "Trip name must be 80 characters or fewer.");

type TripActionResult = ActionResult & { trip?: TripDTO };
type TripsListResult = ActionResult & { trips?: TripDTO[] };

export async function startTripAction(deviceId: number, name: string): Promise<TripActionResult> {
  const parsed = tripNameSchema.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const trip = await startTrip(deviceId, parsed.data);
    revalidatePath("/devices");
    return { trip };
  } catch (err) {
    return toActionError(err);
  }
}

export async function stopTripAction(tripId: string): Promise<TripActionResult> {
  try {
    const trip = await stopTrip(tripId);
    revalidatePath("/devices");
    return { trip };
  } catch (err) {
    return toActionError(err);
  }
}

/** On-demand running total for an ACTIVE trip. */
export async function refreshTripDistanceAction(tripId: string): Promise<TripActionResult> {
  try {
    const trip = await refreshTripDistance(tripId);
    return { trip };
  } catch (err) {
    return toActionError(err);
  }
}

/** Lazy load for the trips dialog (devices table + map popup). */
export async function getTripsForDeviceAction(deviceId: number): Promise<TripsListResult> {
  try {
    const trips = await listTripsForDevice(deviceId);
    return { trips };
  } catch (err) {
    return toActionError(err);
  }
}
