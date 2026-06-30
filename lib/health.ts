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

/** SpO2平均の評価（参考しきい値）。95以上🟢 / 90-94🟡 / <90🔴 */
export function levelSpo2Avg(v: number | null): Level {
  if (v == null) return "none";
  if (v >= 95) return "green";
  if (v >= 90) return "yellow";
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

/* ---------- 目安（参考値）。一般的な睡眠科学/健康指標の目安であり、
   Aki個人の医学的基準でも診断でもない。医学的判断は主治医に委ねる。 ---------- */

/** 各指標の「目安：〜」参考テキスト（深睡眠のみ総睡眠から動的計算するため別扱い）。 */
export const METRIC_REFERENCE: Record<string, string> = {
  seal: "目安：20/20（満点が望ましい）",
  events: "目安：5未満（治療良好域）、0に近いほど良い",
  totalSleep: "目安：7〜9時間（一般成人の推奨）",
  spo2Avg: "目安：95%以上が正常域",
  spo2Min: "目安：90%以上維持",
  minHr:
    "参考：睡眠中は安静時より下がるのが通常。自己ベンチマーク（過去の良夜）は約68〜71bpm",
  rhr: "参考：一般成人の安静時心拍は約60〜100bpm。これは24時間値で活動負荷を含み、減量で下がりやすい指標",
};

/** 深睡眠の目安レンジ＝総睡眠に対する一般成人の割合の目安（参考値）。 */
export const DEEP_SLEEP_PCT_MIN = 0.13;
export const DEEP_SLEEP_PCT_MAX = 0.23;

/**
 * 当夜の総睡眠から深睡眠の目安レンジ（分）と実績％・レンジ比コメントを算出。
 * 評価バッジ自体は既存の絶対分しきい値（levelDeepSleep）を使う。これは参考併記用。
 */
export function deepSleepGuide(
  totalSleepHours: number | null,
  deepSleepMin: number | null
): { rangeMin: number; rangeMax: number; pct: number | null; rel: string } | null {
  if (totalSleepHours == null || totalSleepHours <= 0) return null;
  const totalMin = totalSleepHours * 60;
  const rangeMin = Math.round(totalMin * DEEP_SLEEP_PCT_MIN);
  const rangeMax = Math.round(totalMin * DEEP_SLEEP_PCT_MAX);
  const pct = deepSleepMin != null ? (deepSleepMin / totalMin) * 100 : null;
  let rel = "";
  if (deepSleepMin != null) {
    if (deepSleepMin < rangeMin) rel = "目安レンジのやや下";
    else if (deepSleepMin > rangeMax) rel = "目安レンジのやや上";
    else rel = "目安レンジ内";
  }
  return { rangeMin, rangeMax, pct, rel };
}

/** 睡眠中最低心拍の自己ベンチマーク帯（過去の良夜・参考値。医学的目標値ではない）。 */
export const MINHR_BENCH_LOW = 68;
export const MINHR_BENCH_HIGH = 71;

/** 当夜の睡眠中最低心拍が自己ベンチ帯のどこかを中立コメントで返す（良否判定ではない）。 */
export function minHrBenchComment(v: number | null): string {
  if (v == null) return "";
  if (v < MINHR_BENCH_LOW) return "自己ベンチより低め";
  if (v > MINHR_BENCH_HIGH) return "自己ベンチより高め";
  return "自己ベンチ範囲内";
}

/* ---------- OSCAR実測（DB-A拡張列）の評価・換算 ----------
   評価しきい値の根拠が確立しているもの（AHI/CAI）だけ色を付け、
   根拠が弱いもの（RERA/RDI）は推定ラベルにとどめ色は付けない。 */

/** AHI(OSCAR)の評価。既存Events/hrと同一しきい値を流用（重複実装しない）。 */
export const oscarAhiBadge = levelEvents;

/** CAI（中枢性無呼吸指数・/h換算後）の評価。5未満🟢 / 5-10未満🟡 / 10以上🔴 */
export function caiBadge(caiPerHr: number | null): Level {
  if (caiPerHr == null) return "none";
  if (caiPerHr < 5) return "green";
  if (caiPerHr < 10) return "yellow";
  return "red";
}

/**
 * 圧力95の評価。APAP上限15cmH2Oに対する余裕＝機器設定の妥当性の評価であり、臨床評価ではない。
 * 13未満🟢 / 13-14.8未満🟡 / 14.8以上🔴
 */
export function press95Badge(v: number | null): Level {
  if (v == null) return "none";
  if (v < 13) return "green";
  if (v < 14.8) return "yellow";
  return "red";
}

/** 生カウント（回）を総睡眠(h)で /h 換算する。totalSleepHが無い/0ならnull。 */
export function perHour(
  count: number | null,
  totalSleepH: number | null
): number | null {
  if (count == null || totalSleepH == null || totalSleepH <= 0) return null;
  return count / totalSleepH;
}

/** RDI(推定) = AHI(OSCAR) + RERA/h。いずれかが無ければnull（推定値・確立した臨床指標ではない）。 */
export function rdiEstimate(
  oscarAhi: number | null,
  reraPerHr: number | null
): number | null {
  if (oscarAhi == null || reraPerHr == null) return null;
  return oscarAhi + reraPerHr;
}
