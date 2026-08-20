import { eq } from "drizzle-orm";
import type { ChatGPTUser } from "./chatgpt-auth";
import { ensureDatabase, getDb } from "../db";
import { appUsers } from "../db/schema";

const INITIAL_ADMIN_EMAIL = "dongho4619@gmail.com";

export async function getOrCreateAccess(user: ChatGPTUser, employeeId = "") {
  await ensureDatabase();
  const isOwner = user.email.toLowerCase() === INITIAL_ADMIN_EMAIL;
  const now = new Date().toISOString();
  const [profile] = await getDb().insert(appUsers).values({
    userKey: user.userId, email: user.email, displayName: user.displayName,
    employeeId: employeeId.trim(), isAdmin: isOwner, canViewAdmin: isOwner, updatedAt: now,
  }).onConflictDoUpdate({
    target: appUsers.userKey,
    set: { email: user.email, displayName: user.displayName, ...(employeeId.trim() ? { employeeId: employeeId.trim() } : {}), ...(isOwner ? { isAdmin: true, canViewAdmin: true } : {}), updatedAt: now },
  }).returning();
  return profile;
}

export function hasAdminView(profile: { isAdmin: boolean; canViewAdmin: boolean }) {
  return profile.isAdmin || profile.canViewAdmin;
}

export async function requireAdminView(user: ChatGPTUser, employeeId = "") {
  const profile = await getOrCreateAccess(user, employeeId);
  if (!hasAdminView(profile)) throw new Error("ADMIN_VIEW_REQUIRED");
  return profile;
}

export async function getProfileByUserKey(userKey: string) {
  await ensureDatabase();
  const [profile] = await getDb().select().from(appUsers).where(eq(appUsers.userKey, userKey)).limit(1);
  return profile;
}
