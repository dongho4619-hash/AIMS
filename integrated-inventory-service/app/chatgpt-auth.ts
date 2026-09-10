import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export type ChatGPTUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
  employeeId: string;
  isAdmin: boolean;
};

const USER_ID_HEADER = "oai-authenticated-user-id";
const USER_EMAIL_HEADER = "oai-authenticated-user-email";
const USER_FULL_NAME_HEADER = "oai-authenticated-user-full-name";
const USER_FULL_NAME_ENCODING_HEADER =
  "oai-authenticated-user-full-name-encoding";
const PERCENT_ENCODED_UTF8 = "percent-encoded-utf-8";

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const requestHeaders = await headers();
  const forwardedUserId = requestHeaders.get(USER_ID_HEADER);
  const email = requestHeaders.get(USER_EMAIL_HEADER);
  if (!forwardedUserId || !email) return null;
  const employeeId = requestHeaders.get("x-aims-username")?.trim() || email.split("@")[0];
  const existingUserKey = await findExistingUserKey(employeeId);

  const encodedFullName = requestHeaders.get(USER_FULL_NAME_HEADER);
  const fullName =
    encodedFullName &&
    requestHeaders.get(USER_FULL_NAME_ENCODING_HEADER) === PERCENT_ENCODED_UTF8
      ? safeDecodeURIComponent(encodedFullName)
      : null;

  return {
    userId: existingUserKey || forwardedUserId,
    displayName: fullName ?? email,
    email,
    fullName,
    employeeId,
    isAdmin: requestHeaders.get("x-aims-role") === "admin",
  };
}

async function findExistingUserKey(employeeId: string): Promise<string | null> {
  if (!employeeId || !env.DB) return null;
  try {
    const profile = await env.DB.prepare(
      "SELECT user_key FROM user_profiles WHERE lower(employee_id) = lower(?) ORDER BY id ASC LIMIT 1",
    ).bind(employeeId).first<{ user_key: string }>();
    return profile?.user_key || null;
  } catch {
    return null;
  }
}

export async function requireChatGPTUser(returnTo: string): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;
  redirect(returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/");
}

function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
