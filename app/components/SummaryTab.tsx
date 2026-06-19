"use client";

import type { CpapRow } from "@/lib/types";
import {
  LEVEL_TEXT,
  LEVEL_DOT,
  levelSeal,
  levelEvents,
  levelDeepSleep,
  levelTotalSleep,
  levelSpo2Min,
  isBradycardiaAlert,
  parseDateTs,
  formatNum,
  type Level,
} from "@/lib/health";

const MW_START = parseDateTs("2025-06-11");

function StatCard({
  label,
  value,
  unit,
  level,
  alert,
}: {
  label: string;
  value: number | null;
  unit?: string;
  level: Level;
  alert?: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-[#161616] p-4">
      <div className="text-xs text-gray-400">{label}</div>
      <div className={`mt-1 flex items-baseline gap-1 ${LEVEL_TEXT[level]}`}>
        <span className="text-2xl font-bold">{formatNum(value)}</span>
        {unit && <span className="text-sm text-gray-400">{unit}</span>}
        {LEVEL_DOT[level] && <span className="ml-1 text-base">{LEVEL_DOT[level]}</span>}
      </div>
      {alert && (
        <div className="mt-1 text-xs font-semibold text-red-400">🚨 緊急</div>
      )}
    </div>
  );
}

function PeriodCell({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2 text-center text-gray-200">{children}</td>;
}

export default function SummaryTab({ cpap }: { cpap: CpapRow[] }) {
  if (cpap.length === 0) {
    return (
      <p className="py-10 text-center text-gray-500">
        CPAPデータがありません。
      </p>
    );
  }

  // 最新の夜
  const latest = [...cpap].sort(
    (a, b) => parseDateTs(b.date) - parseDateTs(a.date)
  )[0];

  // アラート判定（全期間）
  const bradyNights = cpap.filter((r) => isBradycardiaAlert(r.minHr));
  const lowSpo2Nights = cpap.filter(
    (r) => r.spo2Min != null && r.spo2Min < 85
  );
  const hasAlert = bradyNights.length > 0 || lowSpo2Nights.length > 0;

  // MW期（6/11以降）の自動集計
  const mw = cpap.filter((r) => parseDateTs(r.date) >= MW_START);
  const avg = (vals: (number | null)[]) => {
    const xs = vals.filter((v): v is number => v != null);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  };
  const min = (vals: (number | null)[]) => {
    const xs = vals.filter((v): v is number => v != null);
    return xs.length ? Math.min(...xs) : null;
  };
  const mwSpo2Avg = avg(mw.map((r) => r.spo2Avg));
  const mwSpo2Min = min(mw.map((r) => r.spo2Min));
  const mwRhr = avg(mw.map((r) => r.rhr));

  return (
    <div className="space-y-6">
      {/* 緊急アラート */}
      {hasAlert && (
        <div className="rounded-xl border border-red-500/50 bg-red-500/10 p-4">
          <div className="flex items-center gap-2 text-red-300">
            <span className="text-lg">🚨</span>
            <span className="font-bold">警告アラート</span>
          </div>
          <ul className="mt-2 space-y-1 text-sm text-red-200">
            {bradyNights.length > 0 && (
              <li>
                睡眠中最低心拍 &lt;40 の夜が {bradyNights.length} 回あります（
                {bradyNights.map((r) => r.date).join("、")}）
              </li>
            )}
            {lowSpo2Nights.length > 0 && (
              <li>
                SpO2最低 &lt;85% の夜が {lowSpo2Nights.length} 回あります（
                {lowSpo2Nights.map((r) => r.date).join("、")}）
              </li>
            )}
          </ul>
        </div>
      )}

      {/* 最新夜サマリー */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-300">
          最新の夜：{latest.date}
          {latest.sleepBand && (
            <span className="ml-2 text-gray-500">（{latest.sleepBand}）</span>
          )}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="Seal" value={latest.seal} level={levelSeal(latest.seal)} />
          <StatCard
            label="Events/hr"
            value={latest.events}
            level={levelEvents(latest.events)}
          />
          <StatCard
            label="SpO2最低"
            value={latest.spo2Min}
            unit="%"
            level={levelSpo2Min(latest.spo2Min)}
          />
          <StatCard
            label="睡眠中最低心拍"
            value={latest.minHr}
            unit="bpm"
            level="none"
            alert={isBradycardiaAlert(latest.minHr)}
          />
          <StatCard
            label="深睡眠"
            value={latest.deepSleep}
            unit="分"
            level={levelDeepSleep(latest.deepSleep)}
          />
          <StatCard
            label="総睡眠"
            value={latest.totalSleep}
            unit="h"
            level={levelTotalSleep(latest.totalSleep)}
          />
        </div>
      </section>

      {/* 3期間比較 */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-300">3期間比較</h2>
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-[#1a1a1a] text-gray-400">
              <tr>
                <th className="px-3 py-2 text-left">期間</th>
                <th className="px-3 py-2">SpO2平均</th>
                <th className="px-3 py-2">SpO2最低</th>
                <th className="px-3 py-2">日次RHR</th>
                <th className="px-3 py-2">HRV</th>
                <th className="px-3 py-2">呼吸数</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              <tr className="bg-[#141414]">
                <td className="px-3 py-2 text-left text-gray-300">
                  CPAP前
                  <span className="ml-1 text-xs text-gray-500">(4/20-30)</span>
                </td>
                <PeriodCell>93.4%</PeriodCell>
                <PeriodCell>82%</PeriodCell>
                <PeriodCell>86.6</PeriodCell>
                <PeriodCell>14.5ms</PeriodCell>
                <PeriodCell>14.9</PeriodCell>
              </tr>
              <tr className="bg-[#141414]">
                <td className="px-3 py-2 text-left text-gray-300">
                  S期
                  <span className="ml-1 text-xs text-gray-500">(5/1-6/10)</span>
                </td>
                <PeriodCell>94.8%</PeriodCell>
                <PeriodCell>85%</PeriodCell>
                <PeriodCell>86.1</PeriodCell>
                <PeriodCell>16.0ms</PeriodCell>
                <PeriodCell>15.1</PeriodCell>
              </tr>
              <tr className="bg-sky-500/5">
                <td className="px-3 py-2 text-left text-sky-300">
                  MW期
                  <span className="ml-1 text-xs text-sky-500/70">(6/11-)</span>
                  <span className="ml-1 text-xs text-gray-500">
                    n={mw.length}
                  </span>
                </td>
                <PeriodCell>
                  {mwSpo2Avg != null ? `${formatNum(mwSpo2Avg)}%` : "—"}
                </PeriodCell>
                <PeriodCell>
                  {mwSpo2Min != null ? `${formatNum(mwSpo2Min, 0)}%` : "—"}
                </PeriodCell>
                <PeriodCell>{formatNum(mwRhr)}</PeriodCell>
                <PeriodCell>—</PeriodCell>
                <PeriodCell>—</PeriodCell>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-xs text-gray-600">
          ※ MW期はDB-Aから自動計算。HRV・呼吸数はDB-Aに項目がないため「—」。
        </p>
      </section>

      {/* 次回タスク・通院 */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-300">
          次回タスク / 通院
        </h2>
        <ul className="space-y-2">
          {[
            "💉 Zepbound PA結果確認（相馬クリニック 808-358-2182）",
            "🩸 ALT再検査（7月予定）",
            "💊 Ro Sparks初回テスト（Ai来訪前）",
            "📦 マスクS→MW交換（8月Coastal 808-545-2500）",
            "🌎 Round One選考進行中（セリトス移住候補）",
          ].map((t, i) => (
            <li
              key={i}
              className="rounded-lg border border-gray-800 bg-[#161616] px-4 py-3 text-sm text-gray-200"
            >
              {t}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
