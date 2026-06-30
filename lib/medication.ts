/** 投薬ログ（MedicationEntry）の選別ロジック（サマリー/薬・サプリタブで共有） */

import type { MedicationEntry } from "@/lib/types";
import { addDaysIso, diffDaysIso } from "@/lib/tz";
import { parseDateTs } from "@/lib/health";
import {
  DUPIXENT_ACTUAL_INTERVAL_DAYS,
  DUPIXENT_SUPPLY_INTERVAL_DAYS,
  DUPIXENT_CALL_INTERVAL_DAYS,
  DUPIXENT_CALL_TO_DELIVERY_LAG_DAYS,
  DUPIXENT_LAST_CALL_DATE,
} from "@/lib/constants";

/** Dupixent判定（英語/日本語表記のどちらでも一致） */
export function isDupixent(drug: string | null): boolean {
  return drug != null && /dupixent|デュピクセント/i.test(drug);
}

/**
 * 直近未来日の次回予定を1件選ぶ（薬剤を問わない）。
 * 該当が無ければ（全て過去日）直近にログされた予定を返す（＝「要更新」表示用）。
 * todayStr は呼び出し元のTZ基準「今日」（YYYY-MM-DD）。
 */
export function nextUpcomingMedication(
  entries: MedicationEntry[],
  todayStr: string
): MedicationEntry | null {
  const withDue = entries.filter((e) => e.nextDue != null);
  if (withDue.length === 0) return null;
  const upcoming = withDue
    .filter((e) => diffDaysIso(e.nextDue as string, todayStr) >= 0)
    .sort(
      (a, b) =>
        diffDaysIso(a.nextDue as string, todayStr) -
        diffDaysIso(b.nextDue as string, todayStr)
    );
  if (upcoming.length > 0) return upcoming[0];
  const sorted = [...withDue].sort(
    (a, b) => parseDateTs(b.date) - parseDateTs(a.date)
  );
  return sorted[0];
}

/** 指定の薬剤判定に一致する最新ログ（日付降順で最初の1件）を返す */
export function latestEntryByDrug(
  entries: MedicationEntry[],
  matcher: (drug: string | null) => boolean
): MedicationEntry | null {
  const matched = entries.filter((e) => matcher(e.drug));
  if (matched.length === 0) return null;
  const sorted = [...matched].sort(
    (a, b) => parseDateTs(b.date) - parseDateTs(a.date)
  );
  return sorted[0];
}

export interface DupixentSchedule {
  lastInjection: string | null; // 最終注射日（ISO）
  actualNext: string | null; // 実・次回(3週) ＝ lastInjection + 21日（本人運用・推定）
  supplyNext: string | null; // 供給上(2週) ＝ lastInjection + 14日（処方ペース）
  nextCall: string | null; // 次回電話(予測) ＝ DUPIXENT_LAST_CALL_DATEから28日刻みでtodayより後の最初の日
  delivery: string | null; // 受取(予測) ＝ nextCall + 4日
}

/**
 * Dupixentの3周期スケジュール（実注射・供給ペース・電話予測）を算出する。
 * 最終注射ログ（lastInjection）が無ければ全フィールドnull（呼び出し側で行ごと非表示）。
 * todayStr は呼び出し元のTZ基準「今日」（YYYY-MM-DD、new Date() 起点・ビルド時固定ではない）。
 */
export function dupixentSchedule(
  entries: MedicationEntry[],
  todayStr: string
): DupixentSchedule {
  const last = latestEntryByDrug(entries, isDupixent);
  if (!last) {
    return {
      lastInjection: null,
      actualNext: null,
      supplyNext: null,
      nextCall: null,
      delivery: null,
    };
  }

  const lastInjection = last.date;
  const actualNext = addDaysIso(lastInjection, DUPIXENT_ACTUAL_INTERVAL_DAYS);
  const supplyNext = addDaysIso(lastInjection, DUPIXENT_SUPPLY_INTERVAL_DAYS);

  // DUPIXENT_LAST_CALL_DATEから28日刻みで加算し、todayStrより後になる最初の日を採用
  let nextCall = DUPIXENT_LAST_CALL_DATE;
  while (diffDaysIso(nextCall, todayStr) <= 0) {
    nextCall = addDaysIso(nextCall, DUPIXENT_CALL_INTERVAL_DAYS);
  }
  const delivery = addDaysIso(nextCall, DUPIXENT_CALL_TO_DELIVERY_LAG_DAYS);

  return { lastInjection, actualNext, supplyNext, nextCall, delivery };
}
