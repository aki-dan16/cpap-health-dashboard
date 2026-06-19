import { NextResponse } from "next/server";
import { queryAllRows, getTitle, getText, getNumber } from "@/lib/notion";
import { parseDateTs } from "@/lib/health";
import type { BloodRow } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const dbId = process.env.NOTION_BLOOD_DB_ID;
  if (!process.env.NOTION_TOKEN || !dbId) {
    return NextResponse.json(
      { rows: [], error: "NOTION_TOKEN / NOTION_BLOOD_DB_ID が未設定です。" },
      { status: 500 }
    );
  }

  try {
    const props = await queryAllRows(dbId);
    const rows: BloodRow[] = props.map((p) => ({
      date: getTitle(p["日付"]),
      alt: getNumber(p["ALT"]),
      ast: getNumber(p["AST"]),
      glucose: getNumber(p["Glucose"]),
      hba1c: getNumber(p["HbA1c(%)"]),
      tg: getNumber(p["TG"]),
      ldl: getNumber(p["LDL"]),
      hdl: getNumber(p["HDL"]),
      egfr: getNumber(p["eGFR"]),
      ggt: getNumber(p["GGT"]),
      vitd: getNumber(p["VitaminD"]),
      tsh: getNumber(p["TSH"]),
      memo: getText(p["メモ"]),
    }));

    rows.sort((a, b) => parseDateTs(a.date) - parseDateTs(b.date));

    return NextResponse.json({ rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "血液検査データの取得に失敗しました。";
    return NextResponse.json({ rows: [], error: msg }, { status: 500 });
  }
}
