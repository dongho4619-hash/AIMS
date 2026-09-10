import { asc, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getOrCreateAccess, getProfileByUserKey } from "../../access";
import { getDb } from "../../../db";
import { appUsers, userProfiles } from "../../../db/schema";

export async function GET(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const employeeId = new URL(request.url).searchParams.get("employeeId")?.trim() ?? "";
    const profile = await getOrCreateAccess(user, employeeId);
    const users = profile.isAdmin
      ? (await getDb().select({ user: appUsers, profile: userProfiles })
          .from(appUsers).innerJoin(userProfiles, eq(userProfiles.userKey, appUsers.userKey))
          .orderBy(asc(userProfiles.employeeId), asc(appUsers.email)))
          .map(({ user: u, profile: p }) => ({
            userKey: u.userKey, email: u.email, displayName: u.displayName,
            employeeId: p.employeeId, isAdmin: p.isAdmin, canViewAdmin: p.canViewAdmin,
          }))
      : [];
    return Response.json({ profile, users });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "권한을 불러오지 못했습니다." }, { status: 500 }); }
}

export async function PATCH(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const admin = await getOrCreateAccess(user);
    if (!admin.isAdmin) return Response.json({ error: "관리자만 권한을 변경할 수 있습니다." }, { status: 403 });
    const payload = await request.json() as Record<string, unknown>;
    const targetUserKey = String(payload.userKey ?? "");
    if (!targetUserKey || targetUserKey === user.userId) return Response.json({ error: "변경할 직원을 확인해 주세요." }, { status: 400 });
    const [updated] = await getDb().update(userProfiles).set({ canViewAdmin: payload.canViewAdmin === true, updatedAt: new Date().toISOString() })
      .where(eq(userProfiles.userKey, targetUserKey)).returning();
    if (!updated) return Response.json({ error: "직원을 찾을 수 없습니다." }, { status: 404 });
    const user_ = await getProfileByUserKey(targetUserKey);
    return Response.json({ user: user_ });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "권한을 변경하지 못했습니다." }, { status: 500 }); }
}
