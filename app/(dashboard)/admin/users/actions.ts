"use server";

import { revalidatePath } from "next/cache";
import { createUser, updateUser, deleteUser, type UserInput } from "@/lib/dal/users";
import { ForbiddenError } from "@/lib/dal/authz";
import { TraccarRequestError } from "@/lib/traccar/client";

type ActionResult = { error?: string };

function toActionError(err: unknown): ActionResult {
  if (err instanceof ForbiddenError) return { error: err.message };
  if (err instanceof TraccarRequestError) return { error: `Traccar rejected the request (${err.status}).` };
  throw err;
}

export async function createUserAction(input: UserInput): Promise<ActionResult> {
  try {
    await createUser(input);
    revalidatePath("/admin/users");
    return {};
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateUserAction(id: number, input: Partial<UserInput>): Promise<ActionResult> {
  try {
    await updateUser(id, input);
    revalidatePath("/admin/users");
    return {};
  } catch (err) {
    return toActionError(err);
  }
}

export async function deleteUserAction(id: number): Promise<ActionResult> {
  try {
    await deleteUser(id);
    revalidatePath("/admin/users");
    return {};
  } catch (err) {
    return toActionError(err);
  }
}
