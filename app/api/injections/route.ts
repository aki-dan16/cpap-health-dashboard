import { NextResponse } from "next/server";
import { getNextInjections } from "@/lib/notion";
import { MEDS_DS_ID } from "@/lib/constants";
import type { NextInjection } from "@/lib/types";

// 他のパネルと同じ設定（常に最新・キャッシュしない）
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  // フェイルセーフ：未設定でも500を出さず空配列（バナー側は非表示）
  if (!process.env.NOTION_TOKEN || !MEDS_DS_ID) {
    return NextResponse.json({ rows: [] as NextInjection[] });
  }

  try {
    const rows = await getNextInjections(MEDS_DS_ID);
    return NextResponse.json({ rows });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "次回注射の取得に失敗しました。";
    return NextResponse.json({ rows: [], error: msg }, { status: 500 });
  }
}
