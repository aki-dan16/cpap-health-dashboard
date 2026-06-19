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
  if (v == null) return "—";
  return Number.isInteger(v) ? String(v) : v.toFixed(digits);
}
