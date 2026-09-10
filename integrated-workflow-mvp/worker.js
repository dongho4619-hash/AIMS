const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" }
});

function accessIdentity(request) {
  const email = request.headers.get("Cf-Access-Authenticated-User-Email") || request.headers.get("oai-authenticated-user-email") || "";
  const name = request.headers.get("Cf-Access-Authenticated-User-Name") || request.headers.get("oai-authenticated-user-full-name") || email;
  return { email: email.toLowerCase().trim(), name: name.trim() };
}

function cookieValue(request, name) {
  const cookies = request.headers.get("cookie") || "";
  return cookies.split(";").map(value => value.trim()).find(value => value.startsWith(`${name}=`))?.slice(name.length + 1) || "";
}

async function digestPassword(password, salt) {
  const encoded = new TextEncoder().encode(password);
  const saltBytes = Uint8Array.from(atob(salt), char => char.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", encoded, "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: saltBytes, iterations: 100000, hash: "SHA-256" }, key, 256);
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

function newSalt() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

async function authUser(request, env) {
  const token = cookieValue(request, "aw_session");
  if (!token || !env.DB) return null;
  return env.DB.prepare("SELECT u.id, u.username, u.display_name, u.role FROM auth_sessions s JOIN auth_users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ? AND u.active = 1").bind(token, new Date().toISOString()).first();
}

function sessionCookie(token) {
  return `aw_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800`;
}

const inventoryApiPaths = new Set([
  "/api/access",
  "/api/audit-log",
  "/api/inventory",
  "/api/materials",
  "/api/request-edits",
  "/api/requests",
  "/api/returns",
  "/api/usage-edits",
  "/api/usages",
]);

function isInventoryRequest(pathname) {
  return pathname === "/inventory-app" ||
    pathname.startsWith("/inventory-app/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/_vinext/image" ||
    inventoryApiPaths.has(pathname) ||
    ["/favicon.svg", "/file.svg", "/globe.svg", "/og.png", "/window.svg"].includes(pathname);
}

async function proxyInventory(request, env, user) {
  if (!env.INVENTORY_SERVICE) {
    return json({ error: "자재관리 내부 서비스가 연결되지 않았습니다." }, 503);
  }
  const target = new URL(request.url);
  if (target.pathname === "/inventory-app" || target.pathname === "/inventory-app/") {
    target.pathname = "/";
  }
  target.protocol = "https:";
  target.host = "inventory.internal";
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("cookie");
  headers.set("oai-authenticated-user-id", `aims-user:${user.id}`);
  headers.set("oai-authenticated-user-email", `${user.username}@integrated.local`);
  headers.set("oai-authenticated-user-full-name", encodeURIComponent(user.display_name || user.username));
  headers.set("oai-authenticated-user-full-name-encoding", "percent-encoded-utf-8");
  headers.set("x-aims-username", user.username);
  headers.set("x-aims-role", user.role);
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : request.body;
  return env.INVENTORY_SERVICE.fetch(
    new Request(target, { method: request.method, headers, body, redirect: "manual" }),
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/auth/")) {
      if (!env.DB) return json({ error: "D1 바인딩 DB가 연결되지 않았습니다." }, 503);
      const now = new Date().toISOString();
      const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM auth_users").first();
      if (url.pathname === "/api/auth/status" && request.method === "GET") {
        const user = await authUser(request, env);
        return json({ setupRequired: Number(count?.count || 0) === 0, authenticated: Boolean(user), user: user ? { username: user.username, displayName: user.display_name, role: user.role, isAdmin: user.role === "admin" } : null });
      }
      if (url.pathname === "/api/auth/setup" && request.method === "POST") {
        if (Number(count?.count || 0) > 0) return json({ error: "관리자 계정이 이미 설정되었습니다." }, 409);
        const body = await request.json();
        const username = String(body.username || "").trim().toLowerCase();
        const password = String(body.password || "").trim();
        const passwordConfirm = String(body.passwordConfirm || "").trim();
        const displayName = String(body.displayName || "관리자").trim() || "관리자";
        if (!/^[a-z0-9._-]{3,30}$/.test(username) || password.length < 8) return json({ error: "아이디는 영문·숫자 3자 이상, 비밀번호는 8자 이상이어야 합니다." }, 400);
        if (password !== passwordConfirm) return json({ error: "비밀번호가 서로 일치하지 않습니다." }, 400);
        try {
          const salt = newSalt();
          const hash = await digestPassword(password, salt);
          await env.DB.prepare("INSERT INTO auth_users (username, password_hash, password_salt, display_name, role, created_at, updated_at) VALUES (?, ?, ?, ?, 'admin', ?, ?)").bind(username, hash, salt, displayName, now, now).run();
          return json({ created: true, username }, 201);
        } catch (error) {
          console.error("Admin setup failed", error);
          return json({ error: "관리자 계정을 저장하지 못했습니다.", code: "ADMIN_SETUP_FAILED" }, 500);
        }
      }
      if (url.pathname === "/api/auth/login" && request.method === "POST") {
        const body = await request.json();
        const username = String(body.username || "").trim().toLowerCase();
        const password = String(body.password || "");
        const user = await env.DB.prepare("SELECT id, username, password_hash, password_salt, display_name, role FROM auth_users WHERE username = ? AND active = 1").bind(username).first();
        if (!user || await digestPassword(password, user.password_salt) !== user.password_hash) return json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, 401);
        const token = crypto.randomUUID();
        const expires = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
        await env.DB.prepare("INSERT INTO auth_sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)").bind(token, user.id, expires, now).run();
        return new Response(JSON.stringify({ authenticated: true, user: { username: user.username, displayName: user.display_name, role: user.role, isAdmin: user.role === "admin" } }), { status: 200, headers: { "content-type": "application/json; charset=utf-8", "set-cookie": sessionCookie(token) } });
      }
      if (url.pathname === "/api/auth/change-password" && request.method === "POST") {
        const user = await authUser(request, env);
        if (!user) return json({ error: "로그인이 필요합니다." }, 401);
        const body = await request.json();
        const currentPassword = String(body.currentPassword || "");
        const newPassword = String(body.newPassword || "");
        const account = await env.DB.prepare("SELECT password_hash, password_salt FROM auth_users WHERE id = ? AND active = 1").bind(user.id).first();
        if (!account || await digestPassword(currentPassword, account.password_salt) !== account.password_hash) return json({ error: "현재 비밀번호가 올바르지 않습니다." }, 401);
        if (newPassword.length < 8) return json({ error: "새 비밀번호는 8자 이상이어야 합니다." }, 400);
        const salt = newSalt();
        const hash = await digestPassword(newPassword, salt);
        await env.DB.prepare("UPDATE auth_users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?").bind(hash, salt, now, user.id).run();
        await env.DB.prepare("DELETE FROM auth_sessions WHERE user_id = ? AND token != ?").bind(user.id, cookieValue(request, "aw_session")).run();
        return json({ changed: true });
      }
      if (url.pathname === "/api/auth/logout" && request.method === "POST") {
        const token = cookieValue(request, "aw_session");
        if (token) await env.DB.prepare("DELETE FROM auth_sessions WHERE token = ?").bind(token).run();
        return new Response(JSON.stringify({ loggedOut: true }), { headers: { "content-type": "application/json; charset=utf-8", "set-cookie": "aw_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0" } });
      }
      return json({ error: "지원하지 않는 인증 요청입니다." }, 405);
    }
    if (url.pathname === "/api/session") {
      const identity = accessIdentity(request);
      const user = await authUser(request, env);
      return json({
        authenticated: Boolean(user || identity.email),
        email: user ? `${user.username}@integrated.local` : identity.email,
        displayName: user?.display_name || identity.name,
        isAdmin: user ? user.role === "admin" : identity.email === "dongho4619@gmail.com",
      });
    }
    if (isInventoryRequest(url.pathname)) {
      const user = await authUser(request, env);
      if (!user) return json({ error: "통합 시스템 로그인이 필요합니다." }, 401);
      return proxyInventory(request, env, user);
    }
    if (url.pathname === "/api/records") {
      if (request.method === "OPTIONS") return new Response(null, { headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type" } });
      if (!env.DB) return json({ error: "D1 바인딩 DB가 연결되지 않았습니다." }, 503);
      if (!await authUser(request, env)) return json({ error: "로그인이 필요합니다." }, 401);
      if (request.method === "GET") {
        const limit = Math.min(Number(url.searchParams.get("limit") || 100), 500);
        const result = await env.DB.prepare("SELECT id, kind, status, payload_json, created_at, updated_at FROM workflow_records ORDER BY created_at DESC LIMIT ?").bind(limit).all();
        return json({ records: result.results.map(row => ({ id: row.id, kind: row.kind, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at, ...JSON.parse(row.payload_json) })) });
      }
      if (request.method === "POST") {
        const body = await request.json();
        const now = new Date().toISOString();
        const id = crypto.randomUUID();
        const payload = { ...body };
        delete payload.kind;
        delete payload.status;
        await env.DB.prepare("INSERT INTO workflow_records (id, kind, status, payload_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").bind(id, body.kind || "unknown", body.status || "등록대기", JSON.stringify(payload), now, now).run();
        return json({ id, kind: body.kind || "unknown", status: body.status || "등록대기", createdAt: now, updatedAt: now, ...payload }, 201);
      }
      return json({ error: "지원하지 않는 요청입니다." }, 405);
    }
    return env.ASSETS.fetch(request);
  }
};
