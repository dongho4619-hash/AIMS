import { getChatGPTUser } from "../../chatgpt-auth";
import { getOrCreateAccess } from "../../access";
import { getD1 } from "../../../db";

type AuditRow = {
  auditKey: string;
  recordType: "request" | "usage";
  recordId: number;
  itemName: string;
  employeeId: string;
  changedFields: string;
  previousValues: string;
  newValues: string;
  editedAt: string;
};

function parseJson<T>(value: string, fallback: T): T {
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

export async function GET() {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const profile = await getOrCreateAccess(user);
    const rows = await getD1().prepare(`
      SELECT 'request-' || re.id AS auditKey, 'request' AS recordType, mr.id AS recordId,
        mr.item_name AS itemName, mr.requester AS employeeId, re.changed_fields AS changedFields,
        re.previous_values AS previousValues, re.new_values AS newValues, re.edited_at AS editedAt
      FROM request_edits re JOIN material_requests mr ON mr.id = re.request_id
      WHERE ? = 1 OR mr.requester_key = ? OR mr.requester = ?
      UNION ALL
      SELECT 'usage-' || ue.id AS auditKey, 'usage' AS recordType, mu.id AS recordId,
        mu.item_name AS itemName, mu.employee_id AS employeeId, ue.changed_fields AS changedFields,
        ue.previous_values AS previousValues, ue.new_values AS newValues, ue.edited_at AS editedAt
      FROM material_usage_edits ue JOIN material_usages mu ON mu.id = ue.usage_id
      WHERE ? = 1 OR mu.user_key = ?
      ORDER BY editedAt DESC LIMIT 300
    `).bind(profile.isAdmin ? 1 : 0, user.userId, profile.employeeId, profile.isAdmin ? 1 : 0, user.userId).all<AuditRow>();
    return Response.json({ logs: rows.results.map(row => ({
      ...row,
      changedFields: parseJson<string[]>(row.changedFields, []),
      previousValues: parseJson<Record<string, unknown>>(row.previousValues, {}),
      newValues: parseJson<Record<string, unknown>>(row.newValues, {}),
    })) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "변경 내역을 불러오지 못했습니다." }, { status: 500 });
  }
}
