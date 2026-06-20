/**
 * マルチタイムゾーン基盤（TZ-1〜TZ-5）
 * 方針：換算・整形・PST/PDT判定は Intl.DateTimeFormat（IANA timeZone）に委譲し、
 *       自前のオフセット計算は持たない（DSTの取りこぼしを防ぐ）。
 */

export type TzCode = "HST" | "PST" | "PDT" | "JST";
/** 現在地セレクタの選択肢（PSTは日付からPST/PDTを自動判定） */
export type LocationTz = "HST" | "PST" | "JST";

const IANA: Record<LocationTz, string> = {
  HST: "Pacific/Honolulu",
  PST: "America/Los_Angeles",
  JST: "Asia/Tokyo",
};

export const LOCATION_OPTIONS: { value: LocationTz; label: string }[] = [
  { value: "HST", label: "ハワイ (HST)" },
  { value: "PST", label: "カリフォルニア (PST/PDT)" },
  { value: "JST", label: "日本 (JST)" },
];

export const LOC_STORAGE_KEY = "cpap_loc_tz";

/** 夜ごとのTZコードを正規化（未設定は HST にフォールバック） — TZ-1 */
export function nightTz(tz: string | null | undefined): TzCode {
  if (tz === "HST" || tz === "PST" || tz === "PDT" || tz === "JST") return tz;
  return "HST";
}

/** 睡眠帯などの時刻表示に、その夜のTZ接尾辞を付与する — TZ-2 */
export function withNightTz(
  timeText: string,
  tz: string | null | undefined
): string {
  if (!timeText) return timeText;
  return `${timeText} ${nightTz(tz)}`;
}

function partsInTz(date: Date, iana: string): { date: string; time: string } {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: iana,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const o: Record<string, string> = {};
  for (const p of f.formatToParts(date)) {
    if (p.type !== "literal") o[p.type] = p.value;
  }
  const hour = o.hour === "24" ? "00" : o.hour; // 一部エンジンの 24:xx を正規化
  return { date: `${o.year}-${o.month}-${o.day}`, time: `${hour}:${o.minute}` };
}

/** 現在地ラベル。PSTのみ日付からPST/PDTを自動判定する — TZ-5 */
export function locationLabel(loc: LocationTz, date: Date): TzCode {
  if (loc === "PST") {
    const abbr = new Intl.DateTimeFormat("en-US", {
      timeZone: IANA.PST,
      timeZoneName: "short",
    })
      .formatToParts(date)
      .find((p) => p.type === "timeZoneName")?.value;
    return abbr === "PDT" ? "PDT" : "PST";
  }
  return loc; // HST / JST は固定オフセット
}

/** 指定TZでの「YYYY-MM-DD」「HH:mm」 */
export function formatInTz(
  date: Date,
  loc: LocationTz
): { date: string; time: string } {
  return partsInTz(date, IANA[loc]);
}

/** 現在地TZでの「今日」(YYYY-MM-DD) — TZ-3（壁時計のTZに依存させない計算用） */
export function todayInTz(loc: LocationTz, now: Date): string {
  return partsInTz(now, IANA[loc]).date;
}

/** ISO日付(YYYY-MM-DD)を日付空間でN日加減算する — TZ-3 */
export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = Date.UTC(y, (m || 1) - 1, d || 1) + days * 86400000;
  const dt = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(
    dt.getUTCDate()
  )}`;
}

/** ISO日付同士の差（a - b）を日数で返す — TZ-3（欠落検知/鮮度用） */
export function diffDaysIso(a: string, b: string): number {
  const toUtc = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return Date.UTC(y, (m || 1) - 1, d || 1);
  };
  return Math.round((toUtc(a) - toUtc(b)) / 86400000);
}

/** 最終更新/現在時刻：現在地表示＋括弧でHST/JSTを併記 — TZ-4 / [27] */
export function formatUpdatedMultiTz(date: Date, loc: LocationTz): string {
  const primary = formatInTz(date, loc);
  const label = locationLabel(loc, date);
  const hst = formatInTz(date, "HST");
  const jst = formatInTz(date, "JST");
  return `${primary.date} ${primary.time} ${label}（HST ${hst.time} / JST ${jst.time}）`;
}
