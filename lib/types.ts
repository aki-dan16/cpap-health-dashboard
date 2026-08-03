/** 正規化済みデータ型（API Routes がこの形で返す） */

export interface CpapRow {
  date: string;
  tz: string; // その夜のTZ（HST/PST/PDT/JST。未設定はHSTにフォールバック）
  sleepBand: string; // 睡眠帯
  seal: number | null;
  events: number | null; // Events/hr
  deepSleep: number | null; // 深睡眠(分)
  totalSleep: number | null; // 総睡眠(h)
  spo2Avg: number | null; // SpO2平均(%)
  spo2Min: number | null; // SpO2最低(%)
  minHr: number | null; // 睡眠中最低心拍
  rhr: number | null; // 日次RHR
  memo: string; // 体感メモ
  // --- PHASE 2（列が無ければ null。データ投入後に自動で表示が立ち上がる） ---
  usageHours: number | null; // 使用時間(h) [21]
  hrv: number | null; // HRV(ms) [22]
  respRate: number | null; // 呼吸数 [22]
  position: string | null; // 体位 [25]
  // --- OSCAR実測列（列が無い/未投入の夜は null） ---
  oscarAhi: number | null; // AHI(OSCAR)
  ca: number | null; // CA(中枢)
  rera: number | null; // RERA
  press95: number | null; // 圧力95(cmH2O)
  oa: number | null; // OA(閉塞)
  ua: number | null; // UA(未分類)
  h: number | null; // H(低呼吸)
}

export interface BloodRow {
  date: string;
  alt: number | null;
  ast: number | null;
  glucose: number | null;
  hba1c: number | null;
  tg: number | null;
  ldl: number | null;
  hdl: number | null;
  egfr: number | null;
  ggt: number | null;
  vitd: number | null; // VitaminD
  tsh: number | null;
  memo: string;
}

export interface WeightRow {
  date: string;
  weight: number | null; // 体重(kg)
  source: string | null; // RENPHO / Elation / DXA
  memo: string;
}

/** D. 投薬ログ（注射・投薬記録） */
export interface MedicationEntry {
  date: string;
  drug: string | null; // 薬剤名（Dupixent / Zepbound / リベルサス 等）
  dose: string; // 用量
  site: string | null; // 投与部位
  nextDue: string | null; // 次回予定日（YYYY-MM-DD）
  memo: string;
}

/** D. 投薬ログから算出する「次回注射」表示用（Dupixent / Zepbound） */
export interface NextInjection {
  drug: "Dupixent" | "Zepbound";
  lastDate: string; // 最終接種日（YYYY-MM-DD）
  nextDate: string; // 次回予定（YYYY-MM-DD）
  dose: string | null; // 用量
  daysUntil: number; // 今日(HST)との差。過去なら負数
}

/** E. 次回タスク（通院・手続き等。Notion DB連動） */
export interface UpcomingTask {
  title: string;
  priority: string | null; // 重要度（🔴最重要 / 🟡注意 / 🟢参考）
  status: string | null; // 状態（未着手 / 進行中 / 完了）
  detail: string; // 詳細
  due: string | null; // 期限（YYYY-MM-DD）
  contact: string; // 連絡先
}

export interface ApiResponse<T> {
  rows: T[];
  error?: string;
}
