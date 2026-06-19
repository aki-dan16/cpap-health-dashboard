import { NextResponse } from "next/server";
import {
  queryAllRows,
  getTitle,
  getText,
  getNumber,
  getSelect,
} from "@/lib/notion";
import { parseDateTs } from "@/lib/health";
import type { WeightRow } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const dbId = process.env.NOTION_WEIGHT_DB_ID;
  if (!process.env.NOTION_TOKEN || !dbId) {
    return NextResponse.json(
      { rows: [], error: "NOTION_TOKEN / NOTION_WEIGHT_DB_ID が未設定です。" },
      { status: 500 }
    );
  }

  try {
    const props = await queryAllRows(dbId);
    const rows: WeightRow[] = props.map((p) => ({
      date: getTitle(p["日付"]),
      weight: getNumber(p["体重(kg)"]),
      source: getSelect(p["ソース"]),
      memo: getText(p["メモ"]),
    }));

    rows.sort((a, b) => parseDateTs(a.date) - parseDateTs(b.date));

    return NextResponse.json({ rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "体重データの取得に失敗しました。";
    return NextResponse.json({ rows: [], error: msg }, { status: 500 });
  }
}
