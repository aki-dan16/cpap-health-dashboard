/** 正規化済みデータ型（API Routes がこの形で返す） */

export interface CpapRow {
  date: string;
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
