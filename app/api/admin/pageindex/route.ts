import { NextResponse } from "next/server";
import { queryDatePageIndex } from "@/lib/notion";
import { parseDateTs } from "@/lib/health";

// [41] 日付→page_id インデックス（管理用）。常に最新を返す。
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const dbId = process.env.NOTION_CPAP_DB_ID;
  if (!process.env.NOTION_TOKEN || !dbId) {
    return NextResponse.json(
      { index: [], error: "NOTION_TOKEN / NOTION_CPAP_DB_ID が未設定です。" },
      { status: 500 }
    );
  }
  try {
    const index = await queryDatePageIndex(dbId);
    index.sort((a, b) => parseDateTs(b.date) - parseDateTs(a.date));
    return NextResponse.json({ index });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "page_idインデックスの取得に失敗しました。";
    return NextResponse.json({ index: [], error: msg }, { status: 500 });
  }
}
