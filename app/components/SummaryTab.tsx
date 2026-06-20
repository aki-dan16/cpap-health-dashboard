"use client";

import type { CpapRow } from "@/lib/types";
import EmptyState from "./EmptyState";
import {
  PERIOD_BASELINES,
  NEXT_TASKS,
  METRIC_INFO,
} from "@/lib/constants";
import {
  withNightTz,
  todayInTz,
  diffDaysIso,
  type LocationTz,
} from "@/lib/tz";
import {
  LEVEL_TEXT,
  LEVEL_DOT,
  levelSeal,
  levelEvents,
  levelDeepSleep,
  levelTotalSleep,
  levelSpo2Min,
  isBradycardiaAlert,
  isValidNight,
  parseDateTs,
  fmtInt,
  fmt1,
  SPO2_MIN_NOTE,
  type Level,
} from "@/lib/health";

const MW_START = parseDateTs("2025-06-11");

// アラートの走査条件（変更しやすいようここに集約）— [10]
const ALERT_WINDOW_DAYS = 14; // 走査窓。7 / 14 / 30 で切替可
const CPAP_START = "2026-05-01"; // 治療開始日。これより前は警告対象外
const ALERT_GAP_DAYS = 3; // データ欠落アラート閾値（[12]）
const DAY_MS = 24 * 60 * 60 * 1000;

function StatCard({
  label,
  value,
  unit,
  level,
  alert,
  format = fmtInt,
  info,
}: {
  label: string;
  value: number | null;
  unit?: string;
  level: Level;
  alert?: boolean;
  format?: (v: number | null) => string; // [43] 指標ごとの桁固定
  info?: string; // [36] ツールチップ説明
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-[#161616] p-4">
      <div className="text-xs text-gray-400" title={info}>
        {label}
        {info && <span className="ml-1 cursor-help text-gray-600">ⓘ</span>}
      </div>
      <div className={`mt-1 flex items-baseline gap-1 ${LEVEL_TEXT[level]}`}>
        <span className="text-2xl font-bold">{format(value)}</span>
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

export default function SummaryTab({
  cpap,
  locTz = "HST",
}: {
  cpap: CpapRow[];
  locTz?: LocationTz;
}) {
  if (cpap.length === 0) {
    return (
      <EmptyState
        icon="🌙"
        title="CPAPデータがありません"
        hint="Notion DB-A（CPAP夜ログ）に夜の記録を追加すると、最新夜サマリーとアラートがここに表示されます。"
      />
    );
  }

  // 最新の夜
  const latest = [...cpap].sort(
    (a, b) => parseDateTs(b.date) - parseDateTs(a.date)
  )[0];

  // アラート判定：「直近の窓 × 治療開始以降 × 有効夜」を満たす夜だけを走査する。[10]
  // 基準日は今日の実日付ではなくデータセットの最新レコード日（ログの空き日があっても空にならない）。
  const latestTs = Math.max(...cpap.map((r) => parseDateTs(r.date)));
  const windowStartTs = latestTs - ALERT_WINDOW_DAYS * DAY_MS;
  const cpapStartTs = parseDateTs(CPAP_START);
  const eligibleNights = cpap.filter(
    (r) =>
      parseDateTs(r.date) >= windowStartTs && // a. 直近 ALERT_WINDOW_DAYS 日以内
      parseDateTs(r.date) >= cpapStartTs && // b. CPAP治療開始日以降
      isValidNight(r) // c. 有効夜（総睡眠>=4h かつ 段階記録あり）
  );
  // 🚨緊急：睡眠中最低心拍<40（有効夜限定 [11]）/ SpO2最低<85
  const bradyNights = eligibleNights.filter((r) => isBradycardiaAlert(r.minHr));
  const lowSpo2Nights = eligibleNights.filter(
    (r) => r.spo2Min != null && r.spo2Min < 85
  );
  const hasAlert = bradyNights.length > 0 || lowSpo2Nights.length > 0;

  // ⚠️注意：直近窓・有効夜で Seal<8 または Events/hr>15（[13]）
  const cautionNights = eligibleNights.filter(
    (r) =>
      (r.seal != null && r.seal < 8) || (r.events != null && r.events > 15)
  );

  // ⚠️データ欠落：最新レコード日が現在地TZの今日から ALERT_GAP_DAYS 日以上離れている（[12]）
  const latestDateStr = latest.date;
  const todayStr = todayInTz(locTz, new Date());
  const gapDays = diffDaysIso(todayStr, latestDateStr);
  const gapAlert = gapDays >= ALERT_GAP_DAYS;

  // 履歴最低 SpO2最低（全期間・中立表示用ベースライン。警告ではなく文脈付きで提示）
  const spo2Nights = cpap.filter((r) => r.spo2Min != null);
  const baselineNight = spo2Nights.length
    ? spo2Nights.reduce((m, r) => (r.spo2Min! < m.spo2Min! ? r : m))
    : null;
  const baselinePreTreatment =
    baselineNight != null && parseDateTs(baselineNight.date) < cpapStartTs;

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

      {/* [12] データ欠落アラート */}
      {gapAlert && (
        <div className="rounded-xl border border-orange-500/40 bg-orange-500/10 p-4 text-sm text-orange-200">
          <span className="font-bold">📭 直近 {gapDays} 日ログなし</span>
          <span className="ml-2 text-orange-300/80">
            最新記録 {latestDateStr}（現在地 {locTz} の今日 {todayStr} 基準）。
            myAirの記録追記をお忘れなく。
          </span>
        </div>
      )}

      {/* [13] 直近の注意（有効夜・Seal<8 / Events>15） */}
      {cautionNights.length > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <div className="flex items-center gap-2 text-amber-300">
            <span>⚠️</span>
            <span className="font-bold">
              直近の注意（直近{ALERT_WINDOW_DAYS}日・有効夜）
            </span>
          </div>
          <ul className="mt-2 space-y-1 text-sm text-amber-200">
            {cautionNights.map((r) => (
              <li key={r.date}>
                {r.date}：
                {r.seal != null && r.seal < 8 && `Seal ${fmtInt(r.seal)}（<8）`}
                {r.seal != null &&
                  r.seal < 8 &&
                  r.events != null &&
                  r.events > 15 &&
                  " / "}
                {r.events != null &&
                  r.events > 15 &&
                  `Events/hr ${fmt1(r.events)}（>15）`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 履歴最低 SpO2最低（中立表示・ベースライン） */}
      {baselineNight && baselineNight.spo2Min != null && (
        <div className="rounded-xl border border-gray-800 bg-[#161616] p-3 text-sm">
          <span className="text-gray-400">履歴最低 SpO2最低：</span>
          <span className="font-semibold text-gray-100">
            {baselineNight.spo2Min}%
          </span>
          <span className="text-gray-500">
            （{baselineNight.date}
            {baselinePreTreatment ? "・治療前ベースライン" : ""}）
          </span>
          <p className="mt-1 text-xs text-gray-600">
            ※ SpO2最低の日次値は24時間値であり、睡眠中限定ではありません。
          </p>
        </div>
      )}

      {/* 最新夜サマリー */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-300">
          最新の夜：{latest.date}
          {latest.sleepBand && (
            <span className="ml-2 text-gray-500">
              （{withNightTz(latest.sleepBand, latest.tz)}）
            </span>
          )}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard
            label="Seal"
            value={latest.seal}
            level={levelSeal(latest.seal)}
            format={fmtInt}
            info={METRIC_INFO.seal}
          />
          <StatCard
            label="Events/hr"
            value={latest.events}
            level={levelEvents(latest.events)}
            format={fmt1}
            info={METRIC_INFO.events}
          />
          <StatCard
            label="SpO2最低"
            value={latest.spo2Min}
            unit="%"
            level={levelSpo2Min(latest.spo2Min)}
            format={fmtInt}
            info={METRIC_INFO.spo2Min}
          />
          <StatCard
            label="睡眠中最低心拍"
            value={latest.minHr}
            unit="bpm"
            level="none"
            alert={isBradycardiaAlert(latest.minHr)}
            format={fmtInt}
            info={METRIC_INFO.minHr}
          />
          <StatCard
            label="深睡眠"
            value={latest.deepSleep}
            unit="分"
            level={levelDeepSleep(latest.deepSleep)}
            format={fmtInt}
            info={METRIC_INFO.deepSleep}
          />
          <StatCard
            label="総睡眠"
            value={latest.totalSleep}
            unit="h"
            level={levelTotalSleep(latest.totalSleep)}
            format={fmt1}
            info={METRIC_INFO.totalSleep}
          />
        </div>
        <p className="mt-2 text-[11px] text-gray-600">{SPO2_MIN_NOTE}</p>
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
              {PERIOD_BASELINES.map((p) => (
                <tr key={p.label} className="bg-[#141414]">
                  <td className="px-3 py-2 text-left text-gray-300">
                    {p.label}
                    <span className="ml-1 text-xs text-gray-500">
                      ({p.range})
                    </span>
                  </td>
                  <PeriodCell>{p.spo2Avg}</PeriodCell>
                  <PeriodCell>{p.spo2Min}</PeriodCell>
                  <PeriodCell>{p.rhr}</PeriodCell>
                  <PeriodCell>{p.hrv}</PeriodCell>
                  <PeriodCell>{p.resp}</PeriodCell>
                </tr>
              ))}
              <tr className="bg-sky-500/5">
                <td className="px-3 py-2 text-left text-sky-300">
                  MW期
                  <span className="ml-1 text-xs text-sky-500/70">(6/11-)</span>
                  <span className="ml-1 text-xs text-gray-500">
                    n={mw.length}
                  </span>
                </td>
                <PeriodCell>
                  {mwSpo2Avg != null ? `${fmt1(mwSpo2Avg)}%` : "—"}
                </PeriodCell>
                <PeriodCell>
                  {mwSpo2Min != null ? `${fmtInt(mwSpo2Min)}%` : "—"}
                </PeriodCell>
                <PeriodCell>{fmt1(mwRhr)}</PeriodCell>
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
          {NEXT_TASKS.map((t, i) => (
            <li
              key={i}
              className="rounded-lg border border-gray-800 bg-[#161616] px-4 py-3 text-sm text-gray-200"
            >
              {t}
            </li>
          ))}
        </ul>
      </section>

      {/* [29] 運用注記：アプリ内/外の境界 */}
      <p className="rounded-lg border border-gray-800 bg-[#141414] px-3 py-2 text-[11px] text-gray-500">
        ℹ️ 運用メモ：myAir画像 →数値抽出 → DB追記は<strong className="text-gray-400">チャット経由</strong>で行います（アプリ内完結ではありません）。本ダッシュボードはNotionに入った数値の閲覧・分析専用です。
      </p>
    </div>
  );
}
