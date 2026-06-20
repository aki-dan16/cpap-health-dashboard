"use client";

import { useEffect, useState } from "react";
import type { CpapRow, BloodRow } from "@/lib/types";
import {
  isValidNight,
  nightUsedFourHours,
  parseDateTs,
  bloodAbnormal,
  fmtInt,
  fmt1,
  COMPLIANCE_WINDOW_DAYS,
  COMPLIANCE_TARGET_PCT,
} from "@/lib/health";
import { PERIOD_BASELINES } from "@/lib/constants";

const DAY_MS = 24 * 60 * 60 * 1000;
const MW_START = parseDateTs("2026-06-11");
const isFullDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

function avg(xs: (number | null)[]): number | null {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
function min(xs: (number | null)[]): number | null {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? Math.min(...v) : null;
}

export default function PrintPage() {
  const [cpap, setCpap] = useState<CpapRow[]>([]);
  const [blood, setBlood] = useState<BloodRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [c, b] = await Promise.all([
        fetch("/api/cpap", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/blood", { cache: "no-store" }).then((r) => r.json()),
      ]);
      setCpap(c.rows ?? []);
      setBlood(b.rows ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <div className="p-8 text-gray-600">読み込み中…</div>;
  }

  // MW期集計
  const mw = cpap.filter((r) => parseDateTs(r.date) >= MW_START);
  const mwSpo2Avg = avg(mw.map((r) => r.spo2Avg));
  const mwSpo2Min = min(mw.map((r) => r.spo2Min));
  const mwRhr = avg(mw.map((r) => r.rhr));

  // 直近トレンド（直近14日の有効夜）
  const latestTs = cpap.length
    ? Math.max(...cpap.map((r) => parseDateTs(r.date)))
    : 0;
  const recent = cpap.filter(
    (r) => parseDateTs(r.date) >= latestTs - 14 * DAY_MS && isValidNight(r)
  );
  const rSpo2Min = min(recent.map((r) => r.spo2Min));
  const rSpo2Avg = avg(recent.map((r) => r.spo2Avg));
  const rEvents = avg(recent.map((r) => r.events));
  const rSeal = avg(recent.map((r) => r.seal));
  const rTotal = avg(recent.map((r) => r.totalSleep));
  const rDeep = avg(recent.map((r) => r.deepSleep));

  // コンプライアンス（直近30日）
  const compNights = cpap.filter(
    (r) => parseDateTs(r.date) >= latestTs - COMPLIANCE_WINDOW_DAYS * DAY_MS
  );
  const compUsed = compNights.filter((r) => nightUsedFourHours(r).used).length;
  const compReal = compNights.some((r) => r.usageHours != null);
  const compPct = compNights.length
    ? Math.round((compUsed / compNights.length) * 100)
    : 0;

  // 血液（完全日付・日付降順）
  const bloodRows = blood
    .filter((r) => isFullDate(r.date))
    .sort((a, b) => parseDateTs(b.date) - parseDateTs(a.date));

  const cell = "border border-gray-400 px-2 py-1 text-center";
  const head = "border border-gray-400 px-2 py-1 bg-gray-100 font-semibold";

  return (
    <div className="min-h-screen bg-white text-black">
      <style>{`
        @media print { .no-print { display: none !important; } @page { margin: 12mm; } }
      `}</style>
      <div className="mx-auto max-w-3xl p-8 text-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">CPAP治療サマリー（主治医提示用）</h1>
          <button
            onClick={() => window.print()}
            className="no-print rounded border border-gray-400 px-3 py-1 text-xs hover:bg-gray-100"
          >
            🖨 印刷
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-600">
          データ範囲：CPAP {cpap.length} 夜 / 血液 {bloodRows.length} 件
        </p>

        {/* コンプライアンス */}
        <h2 className="mt-5 border-b border-gray-300 pb-1 font-bold">
          1. CPAPコンプライアンス（直近{COMPLIANCE_WINDOW_DAYS}日）
        </h2>
        <p className="mt-1">
          4h以上使用：<strong>{compUsed}/{compNights.length} 夜（{compPct}%）</strong>{" "}
          ／ 目標 {COMPLIANCE_TARGET_PCT}% … {compPct >= COMPLIANCE_TARGET_PCT ? "達成" : "未達"}
          {!compReal && "（※使用時間データ未投入のため総睡眠ベースの代理値）"}
        </p>

        {/* 3期間比較 */}
        <h2 className="mt-5 border-b border-gray-300 pb-1 font-bold">
          2. 3期間比較
        </h2>
        <table className="mt-2 w-full border-collapse">
          <thead>
            <tr>
              <th className={head}>期間</th>
              <th className={head}>SpO2平均</th>
              <th className={head}>SpO2最低</th>
              <th className={head}>日次RHR</th>
              <th className={head}>HRV</th>
              <th className={head}>呼吸数</th>
            </tr>
          </thead>
          <tbody>
            {PERIOD_BASELINES.map((p) => (
              <tr key={p.label}>
                <td className={cell}>{p.label} ({p.range})</td>
                <td className={cell}>{p.spo2Avg}</td>
                <td className={cell}>{p.spo2Min}</td>
                <td className={cell}>{p.rhr}</td>
                <td className={cell}>{p.hrv}</td>
                <td className={cell}>{p.resp}</td>
              </tr>
            ))}
            <tr>
              <td className={cell}>MW期 (6/11-) n={mw.length}</td>
              <td className={cell}>{mwSpo2Avg != null ? `${fmt1(mwSpo2Avg)}%` : "—"}</td>
              <td className={cell}>{mwSpo2Min != null ? `${fmtInt(mwSpo2Min)}%` : "—"}</td>
              <td className={cell}>{fmt1(mwRhr)}</td>
              <td className={cell}>—</td>
              <td className={cell}>—</td>
            </tr>
          </tbody>
        </table>

        {/* 直近トレンド */}
        <h2 className="mt-5 border-b border-gray-300 pb-1 font-bold">
          3. 直近トレンド（直近14日・有効夜 {recent.length}夜の平均）
        </h2>
        <table className="mt-2 w-full border-collapse">
          <tbody>
            <tr>
              <td className={head}>SpO2平均</td>
              <td className={cell}>{rSpo2Avg != null ? `${fmt1(rSpo2Avg)}%` : "—"}</td>
              <td className={head}>SpO2最低</td>
              <td className={cell}>{rSpo2Min != null ? `${fmtInt(rSpo2Min)}%` : "—"}</td>
              <td className={head}>Events/hr</td>
              <td className={cell}>{fmt1(rEvents)}</td>
            </tr>
            <tr>
              <td className={head}>Seal</td>
              <td className={cell}>{fmt1(rSeal)}</td>
              <td className={head}>総睡眠</td>
              <td className={cell}>{rTotal != null ? `${fmt1(rTotal)}h` : "—"}</td>
              <td className={head}>深睡眠</td>
              <td className={cell}>{rDeep != null ? `${fmtInt(rDeep)}分` : "—"}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-1 text-xs text-gray-600">
          ※ SpO2最低は24時間値（睡眠中限定ではない）。無効夜（総睡眠&lt;4h・段階記録なし）は集計から除外。
        </p>

        {/* 血液推移 */}
        <h2 className="mt-5 border-b border-gray-300 pb-1 font-bold">
          4. 血液検査推移
        </h2>
        <table className="mt-2 w-full border-collapse text-xs">
          <thead>
            <tr>
              {["日付", "ALT", "AST", "Glu", "HbA1c", "TG", "LDL", "HDL", "eGFR", "GGT", "VitD"].map(
                (h) => (
                  <th key={h} className={head}>{h}</th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {bloodRows.map((r, i) => {
              const c = (v: number | null, ab: boolean) => (
                <td className={`${cell} ${ab ? "font-bold text-red-600" : ""}`}>
                  {fmt1(v)}
                  {ab ? "*" : ""}
                </td>
              );
              return (
                <tr key={i}>
                  <td className={cell}>{r.date}</td>
                  {c(r.alt, bloodAbnormal.alt(r.alt))}
                  {c(r.ast, bloodAbnormal.ast(r.ast))}
                  {c(r.glucose, bloodAbnormal.glucose(r.glucose))}
                  {c(r.hba1c, bloodAbnormal.hba1c(r.hba1c))}
                  {c(r.tg, bloodAbnormal.tg(r.tg))}
                  {c(r.ldl, bloodAbnormal.ldl(r.ldl))}
                  {c(r.hdl, bloodAbnormal.hdl(r.hdl))}
                  {c(r.egfr, bloodAbnormal.egfr(r.egfr))}
                  {c(r.ggt, bloodAbnormal.ggt(r.ggt))}
                  {c(r.vitd, bloodAbnormal.vitd(r.vitd))}
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-1 text-xs text-gray-600">* = 基準値外</p>

        <p className="mt-6 border-t border-gray-300 pt-3 text-xs text-gray-600">
          データの評価は参考値です。医学的判断は主治医（相馬先生）に委ねてください。
        </p>
      </div>
    </div>
  );
}
