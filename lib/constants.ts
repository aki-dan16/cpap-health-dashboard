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

/* ---------- CPAPトレンド：各指標の固定解説（評価バッジは lib/health.ts のしきい値で動的算出） ----------
   キーは TrendTab の ChartDef.key と一致させる。解説は固定テキスト。 */
export const CPAP_METRIC_GUIDE: Record<string, string> = {
  seal: "マスクの密閉度。CPAPの効きを左右する最重要指標。高いほど空気漏れが少ない。評価：≥12🟢 / 8–11🟡 / <8🔴",
  events:
    "1時間あたりの無呼吸・低呼吸の回数。低いほど良い。評価：<5🟢 / 5–15🟡 / >15🔴",
  spo2Min:
    "睡眠中に下がった血中酸素の最低値。低いほど酸素不足。※日次値は24時間値で睡眠中限定ではない。評価：≥90🟢 / 85–89🟡 / <85🔴",
  spo2Avg: "血中酸素の平均。（参考表示）",
  deepSleep:
    "深い睡眠の絶対時間（分）。回復に重要。※割合(%)は総睡眠時間で変動するため分で見る。評価：≥30🟢 / 20–29🟡 / <20🔴",
  totalSleep:
    "覚醒を除いた睡眠合計時間。4h未満は無効夜として集計除外。評価：≥6🟢 / 5–6🟡 / <5🔴",
  minHr:
    "睡眠中の最低心拍。CPAPの効きに反応する指標。40未満は要注意。評価：<40のみ🚨、それ以外は中立。",
  rhr: "24時間ベースの安静時心拍（Apple算出）。日中の活動負荷を含むため、減量しないと下がりにくい。睡眠中最低心拍とは別物。（参考表示）",
};

/* ---------- 血液検査：各項目の固定解説（基準値外の判定は lib/health.ts の bloodAbnormal を流用） ----------
   キーは BloodTab の列キー（types.ts の BloodRow）と一致させる。
   name=日本語名 / desc=平易な意味 / ref=基準値の表示テキスト（一般的な目安）。 */
export interface BloodGuide {
  name: string;
  desc: string;
  ref: string;
}
export const BLOOD_GUIDE: Record<string, BloodGuide> = {
  alt: {
    name: "ALT（肝酵素）",
    desc: "肝臓の酵素。肝細胞がダメージを受けると上昇。脂肪肝などで高くなる。",
    ref: "基準 58以下",
  },
  ast: {
    name: "AST（肝酵素）",
    desc: "肝臓や筋肉に含まれる酵素。ALTと併せて肝臓の状態を見る。",
    ref: "基準 43以下",
  },
  glucose: {
    name: "Glucose（空腹時血糖）",
    desc: "採血時点の血糖値。高いと糖代謝の負担。",
    ref: "基準 99以下",
  },
  hba1c: {
    name: "HbA1c（平均血糖の指標）",
    desc: "過去1〜2か月の平均的な血糖の指標。",
    ref: "基準 5.7%以下",
  },
  tg: {
    name: "TG（中性脂肪）",
    desc: "血液中の脂肪。高いと動脈硬化リスク。",
    ref: "基準 150以下",
  },
  ldl: {
    name: "LDL（悪玉コレステロール）",
    desc: "いわゆる悪玉コレステロール。高いと動脈硬化リスク。",
    ref: "基準 100以下",
  },
  hdl: {
    name: "HDL（善玉コレステロール）",
    desc: "いわゆる善玉コレステロール。低いとリスク。",
    ref: "基準 39以上が望ましい",
  },
  egfr: {
    name: "eGFR（腎機能）",
    desc: "腎臓のろ過機能の推定値。低いと腎機能低下。",
    ref: "基準 89以上が目安",
  },
  ggt: {
    name: "GGT（γ-GTP）",
    desc: "胆道やアルコール性の肝障害で上昇する酵素。",
    ref: "基準 72以下",
  },
  vitd: {
    name: "VitaminD（ビタミンD）",
    desc: "ビタミンD。低すぎても高すぎても良くない。",
    ref: "目安 30〜100",
  },
  tsh: {
    name: "TSH（甲状腺刺激ホルモン）",
    desc: "甲状腺を刺激するホルモン。甲状腺機能の指標。",
    ref: "評価は主治医判断（中立表示）",
  },
};
