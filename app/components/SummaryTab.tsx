"use client";

import type { CpapRow, MedicationEntry } from "@/lib/types";
import EmptyState from "./EmptyState";
import { PERIOD_BASELINES, NEXT_TASKS } from "@/lib/constants";
import {
  withNightTz,
  todayInTz,
  diffDaysIso,
  type LocationTz,
} from "@/lib/tz";
import {
  LEVEL_TEXT,
  LEVEL_BADGE,
  LEVEL_DOT,
  levelSeal,
  levelEvents,
  levelDeepSleep,
  levelTotalSleep,
  levelSpo2Min,
  levelSpo2Avg,
  isBradycardiaAlert,
  isValidNight,
  nightUsedFourHours,
  deepSleepGuide,
  minHrBenchComment,
  METRIC_REFERENCE,
  parseDateTs,
  fmtInt,
  fmt1,
  COMPLIANCE_WINDOW_DAYS,
  type Level,
} from "@/lib/health";

const MW_START = parseDateTs("2025-06-11");

// アラートの走査条件（変更しやすいようここに集約）— [10]
const ALERT_WINDOW_DAYS = 7; // 走査窓。7 / 14 / 30 で切替可（直近7日基準）
const RECENT7_DAYS = 7; // [修正4] 3期間比較の「直近7日間」行の集計窓
const CPAP_START = "2026-05-01"; // 治療開始日。これより前は警告対象外
const ALERT_GAP_DAYS = 3; // データ欠落アラート閾値（[12]）
const DAY_MS = 24 * 60 * 60 * 1000;

// 評価バッジの表示ラベル（lib/health.ts の Level を流用・新規しきい値は定義しない）
const LEVEL_LABEL: Record<Level, string> = {
  green: "🟢 良好",
  yellow: "🟡 注意",
  red: "🔴 要対応",
  none: "",
};

/** 最新有効夜のフル評価表示の1項目（値＋評価バッジ＋解説＋目安/参考）— [修正2/5] */
function NightMetric({
  label,
  value,
  unit,
  level,
  format = fmtInt,
  desc,
  guide,
  extra,
  alert,
}: {
  label: string;
  value: number | null;
  unit?: string;
  level: Level;
  format?: (v: number | null) => string;
  desc: string;
  guide?: string; // 「目安：〜」参考行（参考値・医学的目標値ではない）
  extra?: string; // 追加の中立コメント（自己ベンチ範囲など）
  alert?: boolean; // 🚨（睡眠中最低心拍<40）
}) {
  const badgeText = alert ? "🚨 緊急" : LEVEL_LABEL[level];
  const badgeClass = alert ? LEVEL_BADGE.red : LEVEL_BADGE[level];
  return (
    <div className="rounded-xl border border-gray-800 bg-[#161616] p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs text-gray-400">{label}</span>
        {badgeText && (
          <span
            className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium ${badgeClass}`}
          >
            {badgeText}
          </span>
        )}
      </div>
      <div className={`mt-1 flex items-baseline gap-1 ${LEVEL_TEXT[level]}`}>
        <span className="text-2xl font-bold">{format(value)}</span>
        {unit && <span className="text-sm text-gray-400">{unit}</span>}
      </div>
      <p className="mt-1 text-[11px] text-gray-500">{desc}</p>
      {guide && <p className="mt-0.5 text-[11px] text-gray-400">{guide}</p>}
      {extra && <p className="mt-0.5 text-[11px] text-gray-500">{extra}</p>}
    </div>
  );
}

/** 3期間比較セル：値の後ろに小さな評価ドット（🟢🟡🔴）を併記する。 */
function levelDot(level: Level): string {
  return LEVEL_DOT[level] ? ` ${LEVEL_DOT[level]}` : "";
}

function PeriodCell({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2 text-center text-gray-200">{children}</td>;
}

/**
 * 投薬ログの中から「直近未来日」の次回予定を1件選ぶ。
 * 該当が無ければ（全て過去日）直近にログされた予定を「要更新」として返す。
 * entries は日付（ログ日）降順を前提（getMedicationLog の返り値）。
 */
function nextMedication(
  entries: MedicationEntry[],
  todayStr: string
): MedicationEntry | null {
  const withDue = entries.filter((e) => e.nextDue != null);
  if (withDue.length === 0) return null;
  const upcoming = withDue
    .filter((e) => diffDaysIso(e.nextDue as string, todayStr) >= 0)
    .sort(
      (a, b) =>
        diffDaysIso(a.nextDue as string, todayStr) -
        diffDaysIso(b.nextDue as string, todayStr)
    );
  return upcoming[0] ?? withDue[0];
}

export default function SummaryTab({
  cpap,
  medication = [],
  locTz = "HST",
}: {
  cpap: CpapRow[];
  medication?: MedicationEntry[];
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

  // 日付降順（最新が先頭）
  const sortedDesc = [...cpap].sort(
    (a, b) => parseDateTs(b.date) - parseDateTs(a.date)
  );
  const latest = sortedDesc[0];
  // [修正5] 評価対象は最新の「有効夜」。無効夜は評価に使わない。
  const latestValid = sortedDesc.find(isValidNight) ?? null;
  const latestIsInvalid = latestValid != null && latestValid.date !== latest.date;

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

  // [修正1] 「直近の注意」走査バナーはサマリーから非表示（走査ロジックは将来戻せるよう関数として温存）。

  // ⚠️データ欠落：最新レコード日が現在地TZの今日から ALERT_GAP_DAYS 日以上離れている（[12]）
  const latestDateStr = latest.date;
  const todayStr = todayInTz(locTz, new Date());
  const gapDays = diffDaysIso(todayStr, latestDateStr);
  const gapAlert = gapDays >= ALERT_GAP_DAYS;

  // [21] CPAPコンプライアンス（直近30日・4h以上が70%以上か）。使用時間列が無ければ総睡眠で代理。
  const compWindowStart = latestTs - COMPLIANCE_WINDOW_DAYS * DAY_MS;
  const compNights = cpap.filter((r) => parseDateTs(r.date) >= compWindowStart);
  const compUsed = compNights.filter((r) => nightUsedFourHours(r).used).length;
  const compReal = compNights.some((r) => r.usageHours != null); // 実使用時間データの有無
  const compPct =
    compNights.length > 0
      ? Math.round((compUsed / compNights.length) * 100)
      : 0;

  // 集計ヘルパ（3期間比較の各期間で共有）
  const avg = (vals: (number | null)[]) => {
    const xs = vals.filter((v): v is number => v != null);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  };
  const min = (vals: (number | null)[]) => {
    const xs = vals.filter((v): v is number => v != null);
    return xs.length ? Math.min(...xs) : null;
  };

  // MW期（6/11以降）の自動集計
  const mw = cpap.filter((r) => parseDateTs(r.date) >= MW_START);
  const mwSpo2Avg = avg(mw.map((r) => r.spo2Avg));
  const mwSpo2Min = min(mw.map((r) => r.spo2Min));
  const mwRhr = avg(mw.map((r) => r.rhr));

  // [修正4] 直近7日間（最新レコード日から遡って7日・有効夜のみ）。集計方法はMW期と同一。
  const recent7StartTs = latestTs - RECENT7_DAYS * DAY_MS;
  const recent7 = cpap.filter(
    (r) => parseDateTs(r.date) >= recent7StartTs && isValidNight(r)
  );
  const r7Spo2Avg = avg(recent7.map((r) => r.spo2Avg));
  const r7Spo2Min = min(recent7.map((r) => r.spo2Min));
  const r7Rhr = avg(recent7.map((r) => r.rhr));
  // [修正3] 日次RHRは良否でなくMW期比の傾向（↑↓→と差）で示す
  const r7RhrDiffMw =
    r7Rhr != null && mwRhr != null ? r7Rhr - mwRhr : null;
  const rhrTrend =
    r7RhrDiffMw == null
      ? null
      : `MW期比 ${
          r7RhrDiffMw > 0.05 ? "↑" : r7RhrDiffMw < -0.05 ? "↓" : "→"
        }${fmt1(Math.abs(r7RhrDiffMw))}`;

  // [投薬] 次回投薬予定（直近未来日を1件。無ければ直近ログの予定を「要更新」として表示）
  const nextMed = nextMedication(medication, todayStr);
  const nextMedDiff =
    nextMed?.nextDue != null ? diffDaysIso(nextMed.nextDue, todayStr) : null;

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

      {/* [修正1] 「直近の注意」バナーは非表示（走査ロジックは温存） */}

      {/* [修正5] 最新有効夜のフル評価カード */}
      <section>
        {latestValid ? (
          <>
            <h2 className="mb-1 text-sm font-semibold text-gray-300">
              最新有効夜 {latestValid.date}
              {latestValid.sleepBand && (
                <span className="ml-2 text-gray-500">
                  （{withNightTz(latestValid.sleepBand, latestValid.tz)}）
                </span>
              )}
            </h2>
            {latestIsInvalid && (
              <p className="mb-2 text-[11px] text-gray-600">
                ※ 最新記録 {latest.date} は無効夜（総睡眠&lt;4h
                または段階記録なし）のため、直近の有効夜を表示しています。
              </p>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <NightMetric
                label="Seal"
                value={latestValid.seal}
                level={levelSeal(latestValid.seal)}
                format={fmtInt}
                desc="マスクの密閉度。CPAPの効きを左右する最重要指標。"
                guide={METRIC_REFERENCE.seal}
              />
              <NightMetric
                label="Events/hr"
                value={latestValid.events}
                level={levelEvents(latestValid.events)}
                format={fmt1}
                desc="1時間あたりの無呼吸・低呼吸。低いほど良い。"
                guide={METRIC_REFERENCE.events}
              />
              {(() => {
                const g = deepSleepGuide(
                  latestValid.totalSleep,
                  latestValid.deepSleep
                );
                const guide = g
                  ? `目安：総睡眠の約13〜23%（=この夜なら約${g.rangeMin}〜${g.rangeMax}分）` +
                    (latestValid.deepSleep != null && g.pct != null
                      ? `／実績：${fmtInt(latestValid.deepSleep)}分（${g.pct.toFixed(
                          1
                        )}%・${g.rel}）`
                      : "")
                  : "目安：総睡眠の約13〜23%";
                return (
                  <NightMetric
                    label="深睡眠"
                    value={latestValid.deepSleep}
                    unit="分"
                    level={levelDeepSleep(latestValid.deepSleep)}
                    format={fmtInt}
                    desc="深い睡眠の絶対時間。割合でなく分で見る。"
                    guide={guide}
                  />
                );
              })()}
              <NightMetric
                label="総睡眠"
                value={latestValid.totalSleep}
                unit="h"
                level={levelTotalSleep(latestValid.totalSleep)}
                format={fmt1}
                desc="覚醒を除く睡眠合計。4h未満は無効夜。"
                guide={METRIC_REFERENCE.totalSleep}
              />
              <NightMetric
                label="SpO2平均"
                value={latestValid.spo2Avg}
                unit="%"
                level={levelSpo2Avg(latestValid.spo2Avg)}
                format={fmt1}
                desc="睡眠帯の平均血中酸素。"
                guide={METRIC_REFERENCE.spo2Avg}
              />
              <NightMetric
                label="SpO2最低"
                value={latestValid.spo2Min}
                unit="%"
                level={levelSpo2Min(latestValid.spo2Min)}
                format={fmtInt}
                desc="睡眠中に下がった酸素の最低。※日次値は24時間値で睡眠中限定ではない。"
                guide={METRIC_REFERENCE.spo2Min}
              />
              <NightMetric
                label="睡眠中最低心拍"
                value={latestValid.minHr}
                unit="bpm"
                level="none"
                format={fmtInt}
                alert={isBradycardiaAlert(latestValid.minHr)}
                desc="睡眠中の最低心拍。CPAPの効きに反応。日次RHRとは別物。"
                guide={METRIC_REFERENCE.minHr}
                extra={
                  latestValid.minHr != null
                    ? `当夜 ${fmtInt(latestValid.minHr)}bpm（${minHrBenchComment(
                        latestValid.minHr
                      )}・参考）`
                    : undefined
                }
              />
              <NightMetric
                label="日次RHR"
                value={latestValid.rhr}
                unit="bpm"
                level="none"
                format={fmtInt}
                desc="24時間ベースの安静時心拍。活動負荷を含み、減量しないと下がりにくい。"
                guide={METRIC_REFERENCE.rhr}
              />
            </div>
            <p className="mt-2 text-[11px] text-gray-600">
              ※ 上記の「目安／参考」は一般的な睡眠科学・健康指標の参考値であり、Aki個人の医学的基準・診断ではありません。医学的判断は主治医（相馬先生）に委ねてください。
            </p>
          </>
        ) : (
          <EmptyState
            icon="🌙"
            title="有効夜がまだありません"
            hint="総睡眠4h以上かつ睡眠段階の記録がある夜が追加されると、最新有効夜のフル評価がここに表示されます。"
          />
        )}
      </section>

      {/* 3期間比較（+ 直近7日間） */}
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
              {/* [修正4] 直近7日間（有効夜のみ・MW期と同一の集計方法） */}
              <tr className="bg-emerald-500/5">
                <td className="px-3 py-2 text-left text-emerald-300">
                  直近7日間
                  <span className="ml-1 text-xs text-emerald-500/70">
                    (有効夜)
                  </span>
                  <span className="ml-1 text-xs text-gray-500">
                    n={recent7.length}
                  </span>
                </td>
                <PeriodCell>
                  {r7Spo2Avg != null
                    ? `${fmt1(r7Spo2Avg)}%${levelDot(levelSpo2Avg(r7Spo2Avg))}`
                    : "—"}
                </PeriodCell>
                <PeriodCell>
                  {r7Spo2Min != null
                    ? `${fmtInt(r7Spo2Min)}%${levelDot(levelSpo2Min(r7Spo2Min))}`
                    : "—"}
                </PeriodCell>
                <PeriodCell>
                  <div>{fmt1(r7Rhr)}</div>
                  {rhrTrend && (
                    <div className="text-[10px] text-gray-500">{rhrTrend}</div>
                  )}
                </PeriodCell>
                <PeriodCell>—</PeriodCell>
                <PeriodCell>—</PeriodCell>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-xs text-gray-600">
          ※ MW期・直近7日間はDB-Aから自動計算（有効夜のみ）。HRV・呼吸数はDB-Aに項目がないため「—」。
        </p>
      </section>

      {/* [投薬] 次回投薬予定（Notion D. 投薬ログ DB。未設定/未投入時は非表示） */}
      {nextMed?.nextDue && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-300">
            💉 次回投薬予定
          </h2>
          <div
            className={`rounded-xl border p-4 ${
              nextMedDiff != null && nextMedDiff < 0
                ? "border-red-500/40 bg-red-500/10"
                : "border-sky-500/40 bg-sky-500/10"
            }`}
          >
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-gray-100">
                {nextMed.drug ?? "薬剤未設定"}
              </span>
              <span className="text-sm text-gray-300">{nextMed.nextDue}</span>
              {nextMedDiff != null && (
                <span
                  className={`ml-auto rounded-md px-2 py-0.5 text-xs font-semibold ${
                    nextMedDiff < 0
                      ? "bg-red-500/20 text-red-300"
                      : "bg-sky-500/20 text-sky-300"
                  }`}
                >
                  {nextMedDiff < 0
                    ? "⚠️ 要更新"
                    : nextMedDiff === 0
                      ? "本日"
                      : `あと${nextMedDiff}日`}
                </span>
              )}
            </div>
          </div>
        </section>
      )}

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

      {/* [21] CPAPコンプライアンス（保険要件・代理値）— 下部に小さく表示。誤用防止の注記を維持。 */}
      <p className="rounded-lg border border-gray-800 bg-[#141414] px-3 py-2 text-[11px] text-gray-500">
        CPAPコンプライアンス{compReal ? "（実測）" : "（代理）"}：
        <span className="font-semibold text-gray-300">{compPct}%</span>（
        {compUsed}/{compNights.length}夜が4h以上・直近{COMPLIANCE_WINDOW_DAYS}日）。
        {compReal
          ? "使用時間(h)列に基づく判定。"
          : "総睡眠(h)ベースの代理値。正式な保険要件提示には使用時間(h)列が必要。"}
      </p>

      {/* [29] 運用注記：アプリ内/外の境界 */}
      <p className="rounded-lg border border-gray-800 bg-[#141414] px-3 py-2 text-[11px] text-gray-500">
        ℹ️ 運用メモ：myAir画像 →数値抽出 → DB追記は<strong className="text-gray-400">チャット経由</strong>で行います（アプリ内完結ではありません）。本ダッシュボードはNotionに入った数値の閲覧・分析専用です。
      </p>
    </div>
  );
}
