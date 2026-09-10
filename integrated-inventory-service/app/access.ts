import { eq } from "drizzle-orm";
import type { ChatGPTUser } from "./chatgpt-auth";
import { ensureDatabase, getDb } from "../db";
import { appUsers, userProfiles } from "../db/schema";

type AccessProfile = {
  userKey: string;
  email: string;
  displayName: string;
  department: string;
  employeeId: string;
  isAdmin: boolean;
  canViewAdmin: boolean;
};

function toProfile(user: typeof appUsers.$inferSelect, profile: typeof userProfiles.$inferSelect): AccessProfile {
  return {
    userKey: user.userKey,
    email: user.email,
    displayName: user.displayName,
    department: user.department,
    employeeId: profile.employeeId,
    isAdmin: profile.isAdmin,
    canViewAdmin: profile.canViewAdmin,
  };
}

export async function getOrCreateAccess(user: ChatGPTUser, employeeId = ""): Promise<AccessProfile> {
  await ensureDatabase();
  const isOwner = user.isAdmin;
  const resolvedEmployeeId = employeeId.trim() || user.employeeId;
  const now = new Date().toISOString();
  const db = getDb();

  const [userRow] = await db.insert(appUsers).values({
    userKey: user.userId, email: user.email, displayName: user.displayName, updatedAt: now,
  }).onConflictDoUpdate({
    target: appUsers.userKey,
    set: { email: user.email, displayName: user.displayName, updatedAt: now },
  }).returning();

  const [profileRow] = await db.insert(userProfiles).values({
    userKey: user.userId, employeeId: resolvedEmployeeId, isAdmin: isOwner, canViewAdmin: isOwner, updatedAt: now,
  }).onConflictDoUpdate({
    target: userProfiles.userKey,
    set: { ...(resolvedEmployeeId ? { employeeId: resolvedEmployeeId } : {}), ...(isOwner ? { isAdmin: true, canViewAdmin: true } : {}), updatedAt: now },
  }).returning();

  return toProfile(userRow, profileRow);
}

export function hasAdminView(profile: { isAdmin: boolean; canViewAdmin: boolean }) {
  return profile.isAdmin || profile.canViewAdmin;
}

export async function requireAdminView(user: ChatGPTUser, employeeId = "") {
  const profile = await getOrCreateAccess(user, employeeId);
  if (!hasAdminView(profile)) throw new Error("ADMIN_VIEW_REQUIRED");
  return profile;
}

export async function getProfileByUserKey(userKey: string): Promise<AccessProfile | undefined> {
  await ensureDatabase();
  const db = getDb();
  const [row] = await db.select({ user: appUsers, profile: userProfiles })
    .from(appUsers).innerJoin(userProfiles, eq(userProfiles.userKey, appUsers.userKey))
    .where(eq(appUsers.userKey, userKey)).limit(1);
  return row ? toProfile(row.user, row.profile) : undefined;
}
