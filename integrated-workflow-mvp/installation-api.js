import { intakeFields, engineerFields, cleanFields } from './installation-fields.js';

export async function installationApi(request, db, user) {
  const reply = (data, status = 200) => Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
  if (!user) return reply({ error: '로그인이 필요합니다.' }, 401);
  if (!db) return reply({ error: '데이터베이스가 연결되지 않았습니다.' }, 503);
  const url = new URL(request.url);
  const id = url.pathname.split('/')[3];
  if (!id && request.method === 'GET') {
    const rows = await db.prepare("SELECT * FROM workflow_records WHERE kind = 'installation' ORDER BY created_at DESC LIMIT 500").all();
    return reply({ records: rows.results.map(row => ({ ...JSON.parse(row.payload_json), id: row.id, updatedAt: row.updated_at })) });
  }
  if (request.method !== 'POST' && request.method !== 'PATCH') return reply({ error: '지원하지 않는 요청입니다.' }, 405);
  if (request.headers.get('origin') && request.headers.get('origin') !== url.origin) return reply({ error: '허용되지 않은 요청입니다.' }, 403);
  let body, fields;
  try {
    body = await request.json();
    fields = cleanFields(body, request.method === 'POST' ? intakeFields : engineerFields);
  } catch (error) { return reply({ error: error.message }, 400); }
  const now = new Date().toISOString();
  if (request.method === 'POST' && !id) {
    if (!fields.store || !fields.address) return reply({ error: '상호와 주소를 입력해주세요.' }, 400);
    const recordId = crypto.randomUUID();
    const payload = { intake: fields, engineer: {}, createdBy: user.id, createdAt: now };
    await db.prepare('INSERT INTO workflow_records (id, kind, status, payload_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(recordId, 'installation', '접수', JSON.stringify(payload), now, now).run();
    return reply({ ...payload, id: recordId, updatedAt: now }, 201);
  }
  if (request.method === 'PATCH' && id) {
    const row = await db.prepare("SELECT * FROM workflow_records WHERE id = ? AND kind = 'installation'").bind(id).first();
    if (!row) return reply({ error: '설치요청서를 찾을 수 없습니다.' }, 404);
    if (body.updatedAt !== row.updated_at) return reply({ error: '다른 사용자가 수정했습니다. 목록을 새로고침한 뒤 다시 열어주세요.' }, 409);
    const payload = { ...JSON.parse(row.payload_json), engineer: fields, engineerUpdatedBy: user.id, engineerUpdatedAt: now };
    const result = await db.prepare('UPDATE workflow_records SET payload_json = ?, updated_at = ? WHERE id = ? AND updated_at = ?')
      .bind(JSON.stringify(payload), now, id, row.updated_at).run();
    if (!result.meta.changes) return reply({ error: '동시 수정이 발생했습니다. 다시 열어주세요.' }, 409);
    return reply({ ...payload, id, updatedAt: now });
  }
  return reply({ error: '지원하지 않는 요청입니다.' }, 405);
}
