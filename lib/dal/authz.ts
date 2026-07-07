import "server-only";
import type { SessionPayload } from "@/lib/session";

export class ForbiddenError extends Error {
  constructor(message = "You don't have permission to do this.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function assertAdministrator(session: SessionPayload) {
  if (!session.administrator) throw new ForbiddenError();
}

export function assertWritable(session: SessionPayload) {
  if (session.readonly) throw new ForbiddenError();
}
