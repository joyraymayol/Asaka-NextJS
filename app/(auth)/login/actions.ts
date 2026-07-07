"use server";

import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { z } from "zod";
import {
  traccarLogin,
  traccarLogout,
  TraccarAuthError,
  TraccarRequestError,
} from "@/lib/traccar/client";
import {
  encryptSession,
  decryptSession,
  sessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/lib/session";
import { isRateLimited } from "@/lib/rate-limit";

const loginSchema = z.object({
  email: z.string().min(1, "Required"),
  password: z.string().min(1, "Required"),
});

export type LoginState = { error?: string };

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for") ?? "unknown";
  if (isRateLimited(ip)) {
    return { error: "Too many attempts. Please wait a minute and try again." };
  }

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Username and password are required." };
  }

  try {
    const { user, traccarSessionId } = await traccarLogin(parsed.data.email, parsed.data.password);

    if (user.disabled) {
      return { error: "This account has been disabled." };
    }

    const token = await encryptSession({
      traccarSessionId,
      userId: user.id,
      name: user.name,
      administrator: user.administrator,
      readonly: user.readonly,
      deviceReadonly: user.deviceReadonly,
      limitCommands: user.limitCommands,
      disabled: user.disabled,
    });

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, sessionCookieOptions);
  } catch (err) {
    if (err instanceof TraccarAuthError) {
      return { error: "Invalid username or password." };
    }
    if (err instanceof TraccarRequestError) {
      return { error: "Unable to reach the tracking server. Please try again shortly." };
    }
    throw err;
  }

  redirect("/map");
}

export async function logout() {
  const cookieStore = await cookies();
  const session = await decryptSession(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (session) {
    await traccarLogout(session.traccarSessionId);
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect("/login");
}
