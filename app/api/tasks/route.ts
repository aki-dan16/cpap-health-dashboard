import { NextResponse } from "next/server";
import { getUpcomingTasks } from "@/lib/notion";
import { TASKS_DS_ID } from "@/lib/constants";
import type { UpcomingTask } from "@/lib/types";

// 他のDB-A/OSCARパネルと同じ設定（常に最新・キャッシュしない）
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  // 未設定はフェイルセーフ：500を出さず空配列を返す（フロント側はセクションを空表示にする）
  if (!process.env.NOTION_TOKEN || !TASKS_DS_ID) {
    return NextResponse.json({ rows: [] as UpcomingTask[] });
  }

  try {
    const rows = await getUpcomingTasks(TASKS_DS_ID);
    return NextResponse.json({ rows });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "次回タスクの取得に失敗しました。";
    return NextResponse.json({ rows: [], error: msg }, { status: 500 });
  }
}
