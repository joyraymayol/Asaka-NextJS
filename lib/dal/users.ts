import "server-only";
import { verifySession } from "@/lib/dal/session";
import { assertAdministrator } from "@/lib/dal/authz";
import { traccarFetch } from "@/lib/traccar/client";
import { toUserDto, type UserDTO } from "@/lib/traccar/dto";
import type { TraccarUser } from "@/lib/traccar/types";

export type UserInput = {
  name: string;
  email: string;
  phone: string;
  administrator: boolean;
  readonly: boolean;
  deviceReadonly: boolean;
  limitCommands: boolean;
  disabled: boolean;
  /** Only set on create, or on update when the administrator wants to reset it. */
  password?: string;
};

export async function listUsers(): Promise<UserDTO[]> {
  const session = await verifySession();
  assertAdministrator(session);
  const users = await traccarFetch<TraccarUser[]>(session.traccarSessionId, "/api/users");
  return users.map(toUserDto);
}

export async function createUser(input: UserInput): Promise<UserDTO> {
  const session = await verifySession();
  assertAdministrator(session);
  const created = await traccarFetch<TraccarUser>(session.traccarSessionId, "/api/users", {
    method: "POST",
    body: input,
  });
  return toUserDto(created);
}

async function fetchRawUser(traccarSessionId: string, id: number): Promise<TraccarUser> {
  const users = await traccarFetch<TraccarUser[]>(traccarSessionId, "/api/users");
  const user = users.find((u) => u.id === id);
  if (!user) throw new Error(`Traccar user ${id} not found`);
  return user;
}

// Traccar's PUT is a full replace, so we fetch-then-merge to avoid wiping
// fields we don't manage (map position, attributes, coordinateFormat, ...).
export async function updateUser(id: number, input: Partial<UserInput>): Promise<UserDTO> {
  const session = await verifySession();
  assertAdministrator(session);
  const current = await fetchRawUser(session.traccarSessionId, id);
  const merged: TraccarUser = { ...current, ...input };
  const updated = await traccarFetch<TraccarUser>(session.traccarSessionId, `/api/users/${id}`, {
    method: "PUT",
    body: merged,
  });
  return toUserDto(updated);
}

export async function deleteUser(id: number): Promise<void> {
  const session = await verifySession();
  assertAdministrator(session);
  await traccarFetch<void>(session.traccarSessionId, `/api/users/${id}`, { method: "DELETE" });
}
