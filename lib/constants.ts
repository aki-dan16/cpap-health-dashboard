/**
 * [40] ハードコード値の一元管理。
 * 将来Notion化しやすいよう、画面に直書きしていた固定値をここへ集約する。
 */

/* ---------- [44] 体重目標ライン（確定値が決まれば変更） ---------- */
export const WEIGHT_GOALS_KG: { value: number; label: string; color: string }[] =
  [
    { value: 100, label: "100kg", color: "#ef4444" },
    { value: 95, label: "95kg", color: "#fbbf24" },
    { value: 85, label: "85kg", color: "#34d399" },
  ];

/* ---------- DXAスキャン（2025/6/13時点・固定） ---------- */
export interface DxaItem {
  label: string;
  value: string;
  unit?: string;
  dot?: string;
  tone?: string;
}
export const DXA: { date: string; items: DxaItem[] } = {
  date: "2025/6/13",
  items: [
    { label: "体重", value: "107.9", unit: "kg" },
    { label: "除脂肪", value: "80.4", unit: "kg" },
    { label: "体脂肪", value: "25.5", unit: "%" },
    { label: "VAT", value: "162", unit: "cm²", dot: "🔴", tone: "text-red-400" },
    { label: "T-score", value: "-1.5", dot: "🟡", tone: "text-amber-400" },
  ],
};

/* ---------- 3期間比較：固定ベースライン（MW期はDB-Aから算出） ---------- */
export interface PeriodBaseline {
  label: string;
  range: string;
  spo2Avg: string;
  spo2Min: string;
  rhr: string;
  hrv: string;
  resp: string;
}
export const PERIOD_BASELINES: PeriodBaseline[] = [
  {
    label: "CPAP前",
    range: "4/20-30",
    spo2Avg: "93.4%",
    spo2Min: "82%",
    rhr: "86.6",
    hrv: "14.5ms",
    resp: "14.9",
  },
  {
    label: "S期",
    range: "5/1-6/10",
    spo2Avg: "94.8%",
    spo2Min: "85%",
    rhr: "86.1",
    hrv: "16.0ms",
    resp: "15.1",
  },
];

/* ---------- [14] マスク期バンド ---------- */
export const MASK_BANDS: {
  label: string;
  start?: string;
  end?: string;
  color: string;
}[] = [
  { label: "CPAP前", end: "2026-04-30", color: "#ef4444" },
  { label: "S期", start: "2026-05-01", end: "2026-06-10", color: "#38bdf8" },
  { label: "MW期", start: "2026-06-11", color: "#34d399" },
];

/* ---------- [17] イベント注釈（未確定日はプレースホルダ・要更新） ---------- */
export const EVENT_ANNOTATIONS: { date: string; label: string }[] = [
  { date: "2026-06-11", label: "マスク変更(M wide)" },
  { date: "2026-06-19", label: "SDカード挿入" },
  { date: "2026-08-01", label: "クッション交換(予定・要更新)" },
];

/* ---------- 薬・サプリ（固定） ---------- */
export interface Med {
  name: string;
  dose: string;
  timing: string;
  purpose: string;
}
export const RX: Med[] = [
  {
    name: "リベルサス",
    dose: "3mg",
    timing: "毎朝起床直後・空腹・水120ml以下・服用後30分絶食",
    purpose: "GLP-1減量",
  },
  { name: "アムロジピン", dose: "5mg", timing: "毎朝", purpose: "降圧（CCB）" },
  {
    name: "ロサルタン",
    dose: "50mg",
    timing: "毎朝",
    purpose: "降圧（ARB）+腎保護",
  },
  {
    name: "ロスバスタチン",
    dose: "5mg",
    timing: "毎晩",
    purpose: "脂質（スタチン）",
  },
  {
    name: "デュピクセント",
    dose: "300mg SC",
    timing: "2週に1回",
    purpose: "アトピー",
  },
];
export const SUPP_AM: string[] = [
  "O.N.E. Multivitamin",
  "Nordic Naturals Omega-3 2cap（計4cap/日）",
  "Magnesium Glycinate 1cap",
];
export const SUPP_PM: string[] = [
  "Nordic Naturals Omega-3 2cap",
  "Magnesium Glycinate 2cap",
  "Metagenics D3 5000+K",
  "NAC 600mg",
  "Melatonin 3mg（就寝前）",
];
export const SUPP_HOLD =
  "KSM-66アシュワガンダ（ALT高値のため7月採血後まで開始中止）";

/* ---------- 次回タスク/通院（固定） ---------- */
export const NEXT_TASKS: string[] = [
  "💉 Zepbound PA結果確認（相馬クリニック 808-358-2182）",
  "🩸 ALT再検査（7月予定）",
  "📦 マスクS→MW交換（8月Coastal 808-545-2500）",
];

/* ---------- [36] 指標ツールチップ説明 ---------- */
export const METRIC_INFO: Record<string, string> = {
  seal: "Seal＝マスクの密閉スコア。高いほどリークが少なく有効。≥12🟢 / 8-11🟡 / <8🔴",
  events: "Events/hr＝1時間あたりの無呼吸/低呼吸回数（AHI相当）。<5🟢 / 5-15🟡 / >15🔴",
  deepSleep: "深睡眠は絶対『分』で表示（％ではない）。≥30分🟢",
  totalSleep: "総睡眠時間（h）。≥6h🟢。<4hは無効夜として集計から除外。",
  spo2Avg: "SpO2平均（24時間値・睡眠中限定ではない）。",
  spo2Min: "SpO2最低は24時間値であり睡眠中限定ではありません。≥90🟢 / 85-89🟡 / <85🔴",
  minHr: "睡眠中最低心拍＝CPAP感受指標。<40は緊急アラート。",
  rhr: "日次RHR＝24時間の安静時心拍（減量待ち指標）。睡眠中最低心拍とは別物。",
};
