import test from 'node:test';
import assert from 'node:assert/strict';
import { installationApi } from './installation-api.js';
const user = { id: 'tester' };
function database() {
  const rows = new Map();
  return { rows, prepare(sql) { return { bind(...args) {
    return {
      async first() { return rows.get(args[0]) || null; },
      async run() {
        if (sql.startsWith('INSERT')) { const [id, kind, status, payload_json, created_at, updated_at] = args; rows.set(id, { id, kind, status, payload_json, created_at, updated_at }); return { meta: { changes: 1 } }; }
        const [payload, stamp, id, prior] = args;
        const row = rows.get(id);
        if (!row || row.updated_at !== prior) return { meta: { changes: 0 } };
        row.payload_json = payload; row.updated_at = stamp;
        return { meta: { changes: 1 } };
      }
    };
  }, async all() { return { results: [...rows.values()] }; } }; } };
}
const request = (method, body, id = '', origin) => new Request(`https://example.com/api/installations${id ? '/' + id : ''}`, { method, headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
test('CS intake persists; engineer edit preserves intake and ignores foreign fields', async () => {
  const db = database();
  const created = await installationApi(request('POST', { store: 'Test store', address: 'Test address', waterPressure: 'injected' }), db, user);
  assert.equal(created.status, 201);
  const item = await created.json();
  assert.deepEqual(item.engineer, {});
  const update = await installationApi(request('PATCH', { updatedAt: item.updatedAt, waterPressure: '3 bar', serialNumber1: 'SN-01', store: 'overwritten' }, item.id), db, user);
  assert.equal(update.status, 200);
  const saved = await update.json();
  assert.equal(saved.intake.store, 'Test store');
  assert.equal(saved.engineer.waterPressure, '3 bar');
  const list = await (await installationApi(request('GET'), db, user)).json();
  assert.equal(list.records[0].engineer.serialNumber1, 'SN-01');
  assert.equal((await installationApi(request('PATCH', { updatedAt: 'stale' }, item.id), db, user)).status, 409);
});
test('authentication, validation and same-origin checks', async () => {
  const db = database();
  assert.equal((await installationApi(request('GET'), db, null)).status, 401);
  assert.equal((await installationApi(request('POST', { store: 'Only store' }), db, user)).status, 400);
  assert.equal((await installationApi(request('POST', { store: {}, address: 'x' }), db, user)).status, 400);
  assert.equal((await installationApi(request('POST', { store: 'x', address: 'y' }, '', 'https://evil.example'), db, user)).status, 403);
  assert.equal((await installationApi(request('PATCH', {}, 'missing'), db, user)).status, 404);
});
