/**
 * 睡眠期間の「条件イベント区切り」定義と集計ヘルパ（表示専用）。
 * 治療条件が変わったイベントで区間を区切り、各区間・直近7日・月次を同じ集計器で扱う。
 * DB-A への書き込みや元データの変更は一切しない（read/display のみ）。
 */

import type { CpapRow } from "@/lib/types";
import { parseDateTs, isValidNight } from "@/lib/health";

export interface SleepPeriod {
  key: string;
  label: string;
  start: string; // YYYY-MM-DD
  end: string | null; // null = 継続中（配列で1つだけにする運用）
  excluded: boolean; // true = 表示するが基準強調には使わない（旅行など異常区間）
  /** DB-A per-night に無い外部集計ベースライン（CPAP前/S期）。指標キー→表示文字列。 */
  staticValues?: Partial<Record<"spo2Avg" | "spo2Min" | "rhr" | "hrv", string>>;
}

/**
 * 治療条件イベントの区間定義。将来、条件が変わったら1エントリ足すだけで新区間が増える。
 * 運用：新区間を足すときは、それまで end:null だった区間の end を締めてから末尾に追加する
 *       （end:null は常に1つだけ）。異常区間（旅行など）は excluded:true にする。
 */
export const SLEEP_PERIODS: SleepPeriod[] = [
  {
    key: "pre",
    label: "CPAP前",
    start: "2026-04-20",
    end: "2026-04-30",
    excluded: false,
    staticValues: { spo2Avg: "93.4%", spo2Min: "82%", rhr: "86.6", hrv: "14.5ms" },
  },
  {
    key: "s",
    label: "S期",
    start: "2026-05-01",
    end: "2026-06-10",
    excluded: false,
    staticValues: { spo2Avg: "94.8%", spo2Min: "85%", rhr: "86.1", hrv: "16.0ms" },
  },
  { key: "mw", label: "MW期", start: "2026-06-11", end: "2026-06-30", excluded: false },
  { key: "travel", label: "旅行(異常)", start: "2026-07-01", end: "2026-07-04", excluded: true },
  { key: "home", label: "帰宅安定期", start: "2026-07-05", end: null, excluded: false },
];

export type Agg = "avg" | "min";

/** 指定キーの数値を null 安全に平均/最小で集計する。対象が無ければ null。 */
export function aggregate(
  rows: CpapRow[],
  key: keyof CpapRow,
  agg: Agg
): number | null {
  const xs = rows
    .map((r) => r[key])
    .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
  if (xs.length === 0) return null;
  return agg === "avg"
    ? xs.reduce((a, b) => a + b, 0) / xs.length
    : Math.min(...xs);
}

/** 区間 [start, end||∞] に入る夜。既定は有効夜のみ（無効夜は平均を歪めるため除外）。 */
export function nightsInPeriod(
  cpap: CpapRow[],
  p: SleepPeriod,
  validOnly = true
): CpapRow[] {
  const startTs = parseDateTs(p.start);
  const endTs = p.end ? parseDateTs(p.end) : Infinity;
  return cpap.filter((r) => {
    const t = parseDateTs(r.date);
    return t >= startTs && t <= endTs && (!validOnly || isValidNight(r));
  });
}

/**
 * 「現在の状態」として強調する区間キー。
 * 最新レコード日を含む非excluded区間 → 無ければ最後の非excluded区間。
 */
export function currentPeriodKey(cpap: CpapRow[]): string | null {
  const nonExcluded = SLEEP_PERIODS.filter((p) => !p.excluded);
  if (nonExcluded.length === 0) return null;
  if (cpap.length > 0) {
    const latestTs = Math.max(...cpap.map((r) => parseDateTs(r.date)));
    const containing = nonExcluded.find((p) => {
      const startTs = parseDateTs(p.start);
      const endTs = p.end ? parseDateTs(p.end) : Infinity;
      return latestTs >= startTs && latestTs <= endTs;
    });
    if (containing) return containing.key;
  }
  return nonExcluded[nonExcluded.length - 1].key;
}

/** カレンダー月(YYYY-MM)でグルーピング。既定は有効夜のみ。月の昇順で返す。 */
export function monthlyGroups(
  cpap: CpapRow[],
  validOnly = true
): { month: string; rows: CpapRow[] }[] {
  const map = new Map<string, CpapRow[]>();
  for (const r of cpap) {
    if (validOnly && !isValidNight(r)) continue;
    const month = r.date.replace(/\//g, "-").slice(0, 7); // "YYYY-MM"
    if (month.length !== 7) continue; // パース不能な日付は除外
    const arr = map.get(month) ?? [];
    arr.push(r);
    map.set(month, arr);
  }
  return Array.from(map.entries())
    .map(([month, rows]) => ({ month, rows }))
    .sort((a, b) => a.month.localeCompare(b.month));
}
