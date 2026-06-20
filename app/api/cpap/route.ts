import { NextResponse } from "next/server";
import {
  queryAllRows,
  getTitle,
  getText,
  getNumber,
  getSelect,
} from "@/lib/notion";
import { parseDateTs } from "@/lib/health";
import type { CpapRow } from "@/lib/types";

// 常に最新データを取得（キャッシュしない）
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const dbId = process.env.NOTION_CPAP_DB_ID;
  if (!process.env.NOTION_TOKEN || !dbId) {
    return NextResponse.json(
      { rows: [], error: "NOTION_TOKEN / NOTION_CPAP_DB_ID が未設定です。" },
      { status: 500 }
    );
  }

  try {
    const props = await queryAllRows(dbId);
    const rows: CpapRow[] = props.map((p) => ({
      date: getTitle(p["日付"]),
      // TZ列が無い/未設定の既存レコード（4/20〜6/13等）はHSTにフォールバック
      tz: getSelect(p["TZ"]) ?? "HST",
      sleepBand: getText(p["睡眠帯"]),
      seal: getNumber(p["Seal"]),
      events: getNumber(p["Events/hr"]),
      deepSleep: getNumber(p["深睡眠(分)"]),
      totalSleep: getNumber(p["総睡眠(h)"]),
      spo2Avg: getNumber(p["SpO2平均(%)"]),
      spo2Min: getNumber(p["SpO2最低(%)"]),
      minHr: getNumber(p["睡眠中最低心拍"]),
      rhr: getNumber(p["日次RHR"]),
      memo: getText(p["体感メモ"]),
    }));

    // 日付昇順
    rows.sort((a, b) => parseDateTs(a.date) - parseDateTs(b.date));

    return NextResponse.json({ rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "CPAPデータの取得に失敗しました。";
    return NextResponse.json({ rows: [], error: msg }, { status: 500 });
  }
}
