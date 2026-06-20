/** 健康指標の色分け・基準値ロジック（サマリー/履歴/血液で共有） */

export type Level = "green" | "yellow" | "red" | "none";

/** Tailwind の文字色クラス（ダーク背景前提） */
export const LEVEL_TEXT: Record<Level, string> = {
  green: "text-emerald-400",
  yellow: "text-amber-400",
  red: "text-red-400",
  none: "text-gray-200",
};

/** バッジ用の背景クラス */
export const LEVEL_BADGE: Record<Level, string> = {
  green: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  yellow: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
  red: "bg-red-500/15 text-red-300 border border-red-500/30",
  none: "bg-gray-700/40 text-gray-200 border border-gray-600/40",
};

export const LEVEL_DOT: Record<Level, string> = {
  green: "🟢",
  yellow: "🟡",
  red: "🔴",
  none: "",
};

/* ---------- CPAP 指標の判定 ---------- */

export function levelSeal(v: number | null): Level {
  if (v == null) return "none";
  if (v >= 12) return "green";
  if (v >= 8) return "yellow";
  return "red";
}

export function levelEvents(v: number | null): Level {
  if (v == null) return "none";
  if (v < 5) return "green";
  if (v <= 15) return "yellow";
  return "red";
}

export function levelDeepSleep(v: number | null): Level {
  if (v == null) return "none";
  if (v >= 30) return "green";
  if (v >= 20) return "yellow";
  return "red";
}

export function levelTotalSleep(v: number | null): Level {
  if (v == null) return "none";
  if (v >= 6) return "green";
  if (v >= 5) return "yellow";
  return "red";
}

export function levelSpo2Min(v: number | null): Level {
  if (v == null) return "none";
  if (v >= 90) return "green";
  if (v >= 85) return "yellow";
  return "red";
}

/** 睡眠中最低心拍 <40 は緊急（表示のみ・色分けは特別扱い） */
export function isBradycardiaAlert(v: number | null): boolean {
  return v != null && v < 40;
}

/* ---------- 血液検査の基準値外判定（true = 異常🔴） ---------- */

export const bloodAbnormal = {
  alt: (v: number | null) => v != null && v > 58,
  ast: (v: number | null) => v != null && v > 43,
  glucose: (v: number | null) => v != null && v > 99,
  hba1c: (v: number | null) => v != null && v > 5.7,
  tg: (v: number | null) => v != null && v > 150,
  ldl: (v: number | null) => v != null && v > 100,
  hdl: (v: number | null) => v != null && v < 39,
  egfr: (v: number | null) => v != null && v < 89,
  ggt: (v: number | null) => v != null && v > 72,
  vitd: (v: number | null) => v != null && (v < 30 || v > 100),
} as const;

/* ---------- 日付ユーティリティ ---------- */

/** ソート用の数値タイムスタンプ。パース不能なら 0。 */
export function parseDateTs(s: string): number {
  if (!s) return 0;
  const t = Date.parse(s.replace(/\//g, "-"));
  return Number.isNaN(t) ? 0 : t;
}

export function formatNum(v: number | null, digits = 1): string {
  if (v == null || Number.isNaN(v)) return "—"; // [32] NaN/undefinedを出さない
  return Number.isInteger(v) ? String(v) : v.toFixed(digits);
}

/* ---------- [43] 桁・単位の統一フォーマッタ（表記ゆれ防止） ---------- */

/** 整数固定（心拍・深睡眠分・Seal・SpO2最低など） */
export function fmtInt(v: number | null): string {
  return v == null || Number.isNaN(v) ? "—" : String(Math.round(v));
}

/** 小数1桁固定（総睡眠h・Events/hr・SpO2平均・体重kgなど） */
export function fmt1(v: number | null): string {
  return v == null || Number.isNaN(v) ? "—" : v.toFixed(1);
}

/* ---------- [05] 有効夜判定（無効夜＝総睡眠<4 または 段階記録なし） ---------- */

export const MIN_VALID_SLEEP_HOURS = 4;

/**
 * 有効夜＝総睡眠(h) >= 4 かつ 深睡眠が記録されている（null/未記録でない）。
 * 深睡眠=0 は「記録された0分」とみなし有効。null は「段階記録なし」で無効。
 */
export function isValidNight(r: {
  totalSleep: number | null;
  deepSleep: number | null;
}): boolean {
  return (
    r.totalSleep != null &&
    r.totalSleep >= MIN_VALID_SLEEP_HOURS &&
    r.deepSleep != null
  );
}

/** SpO2最低が24時間値である旨の共通注記（[06]） */
export const SPO2_MIN_NOTE =
  "※ SpO2最低は24時間値であり睡眠中限定ではありません。";

/* ---------- [21] CPAPコンプライアンス（保険要件） ---------- */

export const COMPLIANCE_WINDOW_DAYS = 30;
export const COMPLIANCE_MIN_HOURS = 4;
export const COMPLIANCE_TARGET_PCT = 70;

/**
 * その夜が「4h以上使用」か。使用時間(h)があればそれを、無ければ総睡眠(h)を代理指標に使う。
 * real=true は実使用時間に基づく判定、false は総睡眠ベースの代理。
 */
export function nightUsedFourHours(r: {
  usageHours: number | null;
  totalSleep: number | null;
}): { used: boolean; real: boolean } {
  if (r.usageHours != null)
    return { used: r.usageHours >= COMPLIANCE_MIN_HOURS, real: true };
  if (r.totalSleep != null)
    return { used: r.totalSleep >= COMPLIANCE_MIN_HOURS, real: false };
  return { used: false, real: false };
}
