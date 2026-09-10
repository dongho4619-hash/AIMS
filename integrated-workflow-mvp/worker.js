const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" }
});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/records") {
      if (request.method === "OPTIONS") return new Response(null, { headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type" } });
      if (!env.DB) return json({ error: "D1 바인딩 DB가 연결되지 않았습니다." }, 503);
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
