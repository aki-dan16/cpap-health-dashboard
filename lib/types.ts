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

export interface ApiResponse<T> {
  rows: T[];
  error?: string;
}
