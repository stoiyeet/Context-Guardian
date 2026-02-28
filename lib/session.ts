import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

const SESSION_COOKIE = "cg_session_id";

export function getOrCreateSessionId(): string {
  const store = cookies();
  const env_session = process.env.MONGODB_SESSION_ID
  if (env_session) {
    return env_session
  }
  const existing = store.get(SESSION_COOKIE)?.value;
  if (existing) {
    return existing;
  }
  const created = randomUUID();
  store.set(SESSION_COOKIE, created, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return created;
}
