import { NextResponse } from "next/server";
import { getMedicationLog } from "@/lib/notion";
import { MEDICATION_DB_ID } from "@/lib/constants";
import type { MedicationEntry } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  // 未設定はフェイルセーフ：500を出さず空配列を返す（フロント側はセクションを非表示にする）
  if (!process.env.NOTION_TOKEN || !MEDICATION_DB_ID) {
    return NextResponse.json({ rows: [] as MedicationEntry[] });
  }

  try {
    const rows = await getMedicationLog(MEDICATION_DB_ID);
    return NextResponse.json({ rows });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "投薬ログの取得に失敗しました。";
    return NextResponse.json({ rows: [], error: msg }, { status: 500 });
  }
}
