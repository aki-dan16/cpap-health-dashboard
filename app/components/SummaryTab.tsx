"use client";

import type { CpapRow, MedicationEntry } from "@/lib/types";
import EmptyState from "./EmptyState";
import { NEXT_TASKS, CPAP_PRESSURE_MAX } from "@/lib/constants";
import { dupixentSchedule } from "@/lib/medication";
import {
  SLEEP_PERIODS,
  aggregate,
  nightsInPeriod,
  currentPeriodKey,
  monthlyGroups,
  type SleepPeriod,
  type Agg,
} from "@/lib/periods";
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
  oscarAhiBadge,
  caiBadge,
  press95Badge,
  perHour,
  rdiEstimate,
  parseDateTs,
  fmtInt,
  fmt1,
  COMPLIANCE_WINDOW_DAYS,
  type Level,
} from "@/lib/health";

// アラートの走査条件（変更しやすいようここに集約）— [10]
const ALERT_WINDOW_DAYS = 7; // 走査窓。7 / 14 / 30 で切替可（直近7日基準）
const RECENT7_DAYS = 7; // 直近7日ローリングパネルの集計窓
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
  suffix,
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
  suffix?: string; // 値の右に小さく添える換算表記（例：(=0.8/h)）
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
      <div
        className={`mt-1 flex flex-wrap items-baseline gap-1 ${LEVEL_TEXT[level]}`}
      >
        <span className="text-2xl font-bold">{format(value)}</span>
        {unit && <span className="text-sm text-gray-400">{unit}</span>}
        {suffix && <span className="text-xs text-gray-500">{suffix}</span>}
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

/** ISO日付（YYYY-MM-DD）を「M/D」表記にする（Dupixentスケジュール表示用）。 */
function mdFormat(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}

/* ---------- 比較パネル共通の指標カラム定義（3パネルで共有） ----------
   formatter/level は lib/health 由来（表示層の責務のためここに置く）。
   staticKey がある指標は SleepPeriod.staticValues（外部集計値）を優先表示できる。 */
interface MetricCol {
  key: keyof CpapRow;
  label: string;
  agg: Agg;
  fmt: (v: number | null) => string;
  unit?: string;
  level?: (v: number | null) => Level; // 省略時は中立（バッジなし）
  staticKey?: "spo2Avg" | "spo2Min" | "rhr" | "hrv"; // 外部集計値の対応キー
}

const COMPARE_METRICS: MetricCol[] = [
  { key: "spo2Avg", label: "SpO2平均", agg: "avg", fmt: fmt1, unit: "%", level: levelSpo2Avg, staticKey: "spo2Avg" },
  { key: "spo2Min", label: "SpO2最低", agg: "min", fmt: fmtInt, unit: "%", level: levelSpo2Min, staticKey: "spo2Min" },
  { key: "events", label: "Events/hr", agg: "avg", fmt: fmt1, level: levelEvents },
  { key: "deepSleep", label: "深睡眠", agg: "avg", fmt: fmtInt, unit: "分", level: levelDeepSleep },
  { key: "minHr", label: "睡眠中最低心拍", agg: "avg", fmt: fmtInt, unit: "bpm" },
  { key: "rhr", label: "日次RHR", agg: "avg", fmt: fmtInt, unit: "bpm", staticKey: "rhr" },
  { key: "hrv", label: "HRV", agg: "avg", fmt: fmtInt, unit: "ms", staticKey: "hrv" },
];

// 月次パネル末尾の追加列：OSCAR実測AHIの月平均（デバイス真値・報告用）。
const MONTHLY_EXTRA: MetricCol = {
  key: "oscarAhi",
  label: "AHI(OSCAR)",
  agg: "avg",
  fmt: fmt1,
  level: oscarAhiBadge,
};

/** 1指標セルの表示内容（静的な外部集計値か、DB-Aからの集計か）を組み立てる。 */
function metricCellText(
  col: MetricCol,
  rows: CpapRow[],
  staticValues?: SleepPeriod["staticValues"],
  muted = false // excluded期間はバッジ（基準強調）を付けない
): string {
  const sv = col.staticKey ? staticValues?.[col.staticKey] : undefined;
  if (sv) return sv; // 外部集計値はそのまま（バッジなし）
  const v = aggregate(rows, col.key, col.agg);
  if (v == null) return "—";
  const base = `${col.fmt(v)}${col.unit ?? ""}`;
  const dot = !muted && col.level ? levelDot(col.level(v)) : "";
  return `${base}${dot}`;
}

/** 比較テーブルのヘッダ行（期間ラベル列＋指標列）。 */
function MetricHeader({
  firstCol,
  cols,
}: {
  firstCol: string;
  cols: MetricCol[];
}) {
  return (
    <thead className="bg-[#1a1a1a] text-gray-400">
      <tr>
        <th className="px-3 py-2 text-left">{firstCol}</th>
        {cols.map((c) => (
          <th key={c.key} className="px-3 py-2 whitespace-nowrap">
            {c.label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

/** 比較テーブルの1データ行（指標カラムをまとめて描画）。 */
function MetricRow({
  labelCell,
  rows,
  cols,
  staticValues,
  muted = false,
  rowClass = "",
}: {
  labelCell: React.ReactNode;
  rows: CpapRow[];
  cols: MetricCol[];
  staticValues?: SleepPeriod["staticValues"];
  muted?: boolean;
  rowClass?: string;
}) {
  return (
    <tr className={rowClass}>
      <td className="px-3 py-2 text-left">{labelCell}</td>
      {cols.map((c) => (
        <td
          key={c.key}
          className={`px-3 py-2 text-center whitespace-nowrap ${
            muted ? "text-gray-500" : "text-gray-200"
          }`}
        >
          {metricCellText(c, rows, staticValues, muted)}
        </td>
      ))}
    </tr>
  );
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
        title="睡眠データがありません"
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

  // [パネルB] 直近7日ローリング（最新レコード日から7日窓・有効夜のみ）。常設。
  const recent7StartTs = latestTs - RECENT7_DAYS * DAY_MS;
  const recent7 = cpap.filter(
    (r) => parseDateTs(r.date) >= recent7StartTs && isValidNight(r)
  );

  // [パネルA/C] 現在強調する期間キー、月次グループ（カレンダー月・有効夜のみ・昇順）。
  const currentKey = currentPeriodKey(cpap);
  const months = monthlyGroups(cpap);

  // [投薬] 最新有効夜カードの「投薬」行用：Dupixentの3周期スケジュール（実注射/供給ペース/電話予測）
  const dupixent = dupixentSchedule(medication, todayStr);

  // [OSCAR] 表示（display）のみのフォールバック。DB-Aの各夜レコードは一切変更しない。
  // 表示中の夜(latestValid)にOSCAR実測が無ければ、DB-A全体から代表列(AHI(OSCAR))が
  // non-nullな最新の夜を日付降順で動的に検索し、日付ラベル付きでスナップショット表示する。
  const hasOwnOscar = latestValid?.oscarAhi != null;
  const latestOscarNight: CpapRow | null = hasOwnOscar
    ? null
    : [...cpap]
        .sort((a, b) => parseDateTs(b.date) - parseDateTs(a.date))
        .find((r) => r.oscarAhi != null) ?? null;
  const oscarNight: CpapRow | null = hasOwnOscar
    ? latestValid
    : latestOscarNight;
  const oscarIsFallback = !hasOwnOscar && oscarNight != null;
  // 各カードの微小ラベル：フォールバック時は「当夜」と誤認させないよう「実測」表記にする。
  const oscarValueLabel = oscarIsFallback ? "実測" : "当夜";

  // CA/RERAの/h換算とRDI(推定)。総睡眠(h)はoscarNight（表示対象の夜）自身の値を使う。
  const caiPerHr = oscarNight
    ? perHour(oscarNight.ca, oscarNight.totalSleep)
    : null;
  const reraPerHr = oscarNight
    ? perHour(oscarNight.rera, oscarNight.totalSleep)
    : null;
  const rdiEst = oscarNight
    ? rdiEstimate(oscarNight.oscarAhi, reraPerHr)
    : null;
  const press95Margin =
    oscarNight?.press95 != null
      ? CPAP_PRESSURE_MAX - oscarNight.press95
      : null;

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

            {/* [OSCAR] デバイス実測（DB-A拡張列）。当夜に未投入ならDB-A全体から
                直近の実測夜を検索し、日付ラベル付きでスナップショット表示する（表示のみ・書き込みなし）。 */}
            <h3 className="mb-1 mt-4 text-xs font-semibold text-gray-400">
              {oscarIsFallback && oscarNight
                ? `最新OSCAR（${oscarNight.date}時点）`
                : "当夜のOSCAR"}
            </h3>
            {oscarIsFallback && (
              <p className="mb-2 text-[11px] text-amber-500/80">
                ※この夜のOSCARは未取得。直近の実測値を表示しています。
              </p>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <NightMetric
                label="AHI(OSCAR)"
                value={oscarNight?.oscarAhi ?? null}
                level={oscarAhiBadge(oscarNight?.oscarAhi ?? null)}
                format={fmt1}
                desc="OSCAR実測のAHI。機内蔵Events/hrと並べて対照用。"
                guide="目安：5未満＝治療良好域。0に近いほど良い。"
                extra={
                  oscarNight?.oscarAhi != null
                    ? `${oscarValueLabel}：${fmt1(oscarNight.oscarAhi)}/h（バッジ評価に対応）`
                    : `${oscarValueLabel}：—`
                }
              />
              <NightMetric
                label="CA(中枢)"
                value={oscarNight?.ca ?? null}
                level={caiPerHr != null ? caiBadge(caiPerHr) : "none"}
                format={fmtInt}
                suffix={caiPerHr != null ? `(=${caiPerHr.toFixed(1)}/h)` : undefined}
                desc="中枢性無呼吸イベント数（OSCAR実測）。"
                guide="目安：CAI 5/h未満＝問題域外（5以上で治療誘発性中枢無呼吸の目安）。"
                extra={
                  oscarNight?.ca != null
                    ? `${oscarValueLabel}：${fmtInt(oscarNight.ca)}回` +
                      (caiPerHr != null
                        ? ` ＝ ${caiPerHr.toFixed(1)}/h（バッジ評価に対応）`
                        : "")
                    : `${oscarValueLabel}：—`
                }
              />
              <NightMetric
                label="RERA"
                value={oscarNight?.rera ?? null}
                level="none"
                format={fmtInt}
                suffix={
                  reraPerHr != null ? `(=${reraPerHr.toFixed(1)}/h)` : undefined
                }
                desc="呼吸努力関連覚醒の回数（OSCAR実測）。"
                guide="目安：RERA単独の確立基準はない。RDI(推定)に合算して評価する。"
                extra={
                  oscarNight?.rera != null
                    ? `${oscarValueLabel}：${fmtInt(oscarNight.rera)}回` +
                      (reraPerHr != null ? ` ＝ ${reraPerHr.toFixed(1)}/h` : "") +
                      (rdiEst != null
                        ? ` → RDI(推定) ${rdiEst.toFixed(1)}/h（5超で境界・推定）`
                        : "")
                    : `${oscarValueLabel}：—`
                }
              />
              <NightMetric
                label="圧力95"
                value={oscarNight?.press95 ?? null}
                unit="cmH2O"
                level={press95Badge(oscarNight?.press95 ?? null)}
                format={fmt1}
                desc="圧力の95パーセンタイル値（OSCAR実測）。"
                guide={`目安：APAP上限${CPAP_PRESSURE_MAX}に対し余裕があるほど良い（上限張り付き＝圧不足の兆候）。`}
                extra={
                  press95Margin != null
                    ? `${oscarValueLabel}：上限まで ${press95Margin.toFixed(1)}（余裕あり/なしはバッジに対応）。※機器設定の妥当性であり臨床評価ではない。`
                    : `${oscarValueLabel}：—`
                }
              />
            </div>
            {rdiEst != null && (
              <p className="mt-2 text-[11px] text-gray-500">
                RDI(推定) ≈ {rdiEst.toFixed(1)}/h　AHI＋RERA/h・5超で境界（推定）
              </p>
            )}
            <p className="mt-1 text-[11px] text-gray-600">
              評価基準：AHI・CAI＝確立した一般目安／RERA・RDI＝推定／圧力95＝機器設定の妥当性（臨床評価ではない）。医療判断は主治医。
            </p>

            {/* [投薬] Dupixent 3周期スケジュール（実注射/供給ペース/電話予測）。最終注射が無ければ非表示 */}
            {dupixent.lastInjection &&
              dupixent.actualNext &&
              dupixent.supplyNext &&
              dupixent.nextCall &&
              dupixent.delivery && (
                <div className="mt-3 rounded-lg border border-gray-800 bg-[#141414] px-3 py-2 text-xs">
                  <div className="font-semibold text-gray-300">
                    💉 Dupixent
                  </div>
                  <div className="mt-1 text-gray-500">
                    最終注射：
                    <span className="text-gray-200">
                      {mdFormat(dupixent.lastInjection)}
                    </span>
                  </div>
                  <div className="mt-0.5 text-sky-300">
                    実・次回(3週)：
                    <span className="text-sm font-semibold">
                      {mdFormat(dupixent.actualNext)}
                    </span>
                    <span className="ml-1 text-[11px] text-sky-400/80">
                      （推定・本人運用）
                    </span>
                  </div>
                  <div className="mt-0.5 text-gray-500">
                    供給上(2週)：{mdFormat(dupixent.supplyNext)}
                    （処方ペース）
                  </div>
                  <div className="mt-0.5 text-gray-500">
                    次回電話(予測)：{mdFormat(dupixent.nextCall)}頃 → 受取
                    {mdFormat(dupixent.delivery)}頃（月1・推定）
                  </div>
                </div>
              )}
          </>
        ) : (
          <EmptyState
            icon="🌙"
            title="有効夜がまだありません"
            hint="総睡眠4h以上かつ睡眠段階の記録がある夜が追加されると、最新有効夜のフル評価がここに表示されます。"
          />
        )}
      </section>

      {/* パネルA：期間比較（条件イベント区切り・config駆動） */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-300">
          期間比較（条件区切り）
        </h2>
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full min-w-[720px] text-sm">
            <MetricHeader firstCol="期間" cols={COMPARE_METRICS} />
            <tbody className="divide-y divide-gray-800">
              {SLEEP_PERIODS.map((p) => {
                const isStatic = p.staticValues != null;
                const rows = isStatic ? [] : nightsInPeriod(cpap, p);
                const isCurrent = p.key === currentKey;
                const rowClass = p.excluded
                  ? "bg-[#141414] opacity-60"
                  : isCurrent
                    ? "bg-sky-500/10 ring-1 ring-inset ring-sky-500/40"
                    : "bg-[#141414]";
                return (
                  <MetricRow
                    key={p.key}
                    rows={rows}
                    cols={COMPARE_METRICS}
                    staticValues={p.staticValues}
                    muted={p.excluded}
                    rowClass={rowClass}
                    labelCell={
                      <span
                        className={
                          p.excluded
                            ? "text-gray-500"
                            : isCurrent
                              ? "text-sky-300"
                              : "text-gray-300"
                        }
                      >
                        {p.excluded && "⚠️ "}
                        {p.label}
                        {isCurrent && (
                          <span className="ml-1 rounded bg-sky-500/20 px-1 text-[10px] text-sky-300">
                            現在
                          </span>
                        )}
                        <span className="ml-1 block text-[10px] text-gray-500">
                          {p.excluded
                            ? "異常/除外"
                            : isStatic
                              ? "外部集計"
                              : `n=${rows.length}`}
                        </span>
                      </span>
                    }
                  />
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-xs text-gray-600">
          ※ 治療条件が変わったイベントで区間を区切り、各区間はDB-Aから自動集計（有効夜のみ）。CPAP前・S期は外部集計ベースライン。旅行(異常)は基準強調に使いません。HRV等はDB-A未投入だと「—」。
        </p>
      </section>

      {/* パネルB：直近7日ローリング（常設・条件区切りとは独立） */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-300">
          直近7日間（有効夜）
        </h2>
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full min-w-[720px] text-sm">
            <MetricHeader firstCol="期間" cols={COMPARE_METRICS} />
            <tbody className="divide-y divide-gray-800">
              <MetricRow
                rows={recent7}
                cols={COMPARE_METRICS}
                rowClass="bg-emerald-500/5"
                labelCell={
                  <span className="text-emerald-300">
                    直近7日間
                    <span className="ml-1 block text-[10px] text-gray-500">
                      最新記録日基準・n={recent7.length}
                    </span>
                  </span>
                }
              />
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-xs text-gray-600">
          ※ 最新レコード日から遡って7日間の有効夜を集計。「今、良くなっているか」を早く見るための枠です。
        </p>
      </section>

      {/* パネルC：月次（カレンダー月） */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-300">月次</h2>
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full min-w-[800px] text-sm">
            <MetricHeader
              firstCol="月"
              cols={[...COMPARE_METRICS, MONTHLY_EXTRA]}
            />
            <tbody className="divide-y divide-gray-800">
              {months.length === 0 ? (
                <tr className="bg-[#141414]">
                  <td
                    colSpan={COMPARE_METRICS.length + 2}
                    className="px-3 py-3 text-center text-gray-500"
                  >
                    —
                  </td>
                </tr>
              ) : (
                months.map((m) => (
                  <MetricRow
                    key={m.month}
                    rows={m.rows}
                    cols={[...COMPARE_METRICS, MONTHLY_EXTRA]}
                    rowClass="bg-[#141414]"
                    labelCell={
                      <span className="text-gray-300">
                        {m.month}
                        <span className="ml-1 block text-[10px] text-gray-500">
                          n={m.rows.length}
                        </span>
                      </span>
                    }
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-xs text-gray-600">
          ※ カレンダー月ごとの平均（有効夜のみ）。長期の地合い・報告用。AHI(OSCAR)はOSCAR実測がある夜のみ月平均。月次コンプライアンスは下部の直近{COMPLIANCE_WINDOW_DAYS}日表示と定義が二重化するためここには出しません。
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
