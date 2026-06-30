/** 投薬ログ（MedicationEntry）の選別ロジック（サマリー/薬・サプリタブで共有） */

import type { MedicationEntry } from "@/lib/types";
import { diffDaysIso } from "@/lib/tz";
import { parseDateTs } from "@/lib/health";

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
