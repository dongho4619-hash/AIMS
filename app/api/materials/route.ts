import { asc, eq, sql } from "drizzle-orm";
import { ensureDatabase, getDb } from "../../../db";
import { materials } from "../../../db/schema";

export async function GET() {
  try {
    await ensureDatabase();
    const rows = await getDb().select({
      sourceKey: materials.sourceKey,
      itemCode: materials.itemCode,
      itemName: materials.itemName,
      abbreviation: materials.abbreviation,
      category: materials.category,
      specification: materials.specification,
      notes: materials.notes,
    }).from(materials).where(eq(materials.active, true)).orderBy(
      sql`CASE ${materials.category}
        WHEN '완제품' THEN 1 WHEN '반제품' THEN 2 WHEN '원자재' THEN 3 WHEN '부자재' THEN 4
        WHEN '설치자재' THEN 5 WHEN '공구' THEN 6 WHEN '관리자재' THEN 7 WHEN '박람회 자재' THEN 8
        ELSE 9 END`,
      asc(materials.sortOrder),
    );
    return Response.json({ materials: rows, total: rows.length });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "자재 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}
