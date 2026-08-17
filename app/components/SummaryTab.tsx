"use client";

import type { CpapRow, UpcomingTask } from "@/lib/types";
import EmptyState from "./EmptyState";
import DataGapNote from "./DataGapNote";
import { CPAP_PRESSURE_MAX } from "@/lib/constants";
import {
  withNightTz,
  todayInTz,
  diffDaysIso,
  type LocationTz,
} from "@/lib/tz";
import {
  LEVEL_TEXT,
  LEVEL_BADGE,
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
const RECENT7_DAYS = 7; // 直近7日ローリングの集計窓
const RECENT30_DAYS = 30; // 直近30日の集計窓
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

/** null安全な平均。対象が無ければ null。 */
function avgOf(rows: CpapRow[], key: keyof CpapRow): number | null {
  const xs = rows
    .map((r) => r[key])
    .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

/** 最新有効夜のフル評価表示の1項目（値＋評価バッジ＋解説＋目安/参考） */
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

/** 数値サマリー用の小型スタットセル。 */
function StatCell({
  label,
  value,
  sub,
  level = "none",
}: {
  label: string;
  value: string;
  sub?: string;
  level?: Level;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-[#161616] p-3">
      <div className="text-xs text-gray-400">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${LEVEL_TEXT[level]}`}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-gray-500">{sub}</div>}
    </div>
  );
}

/** ISO日付（YYYY-MM-DD）を「M/D」表記にする（期限表示用）。 */
function mdFormat(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}

/** 重要度セレクト値（例「🔴最重要」）の先頭絵文字だけを取り出す。無ければ空。 */
function priorityLead(priority: string | null): string {
  if (!priority) return "";
  return Array.from(priority)[0] ?? "";
}

export default function SummaryTab({
  cpap,
  tasks = [],
  locTz = "HST",
}: {
  cpap: CpapRow[];
  tasks?: UpcomingTask[];
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
  // 評価対象は最新の「有効夜」。無効夜は評価に使わない。
  const latestValid = sortedDesc.find(isValidNight) ?? null;
  const latestIsInvalid = latestValid != null && latestValid.date !== latest.date;

  // アラート判定：「直近の窓 × 治療開始以降 × 有効夜」を満たす夜だけを走査する。[10]
  const latestTs = Math.max(...cpap.map((r) => parseDateTs(r.date)));
  const windowStartTs = latestTs - ALERT_WINDOW_DAYS * DAY_MS;
  const cpapStartTs = parseDateTs(CPAP_START);
  const eligibleNights = cpap.filter(
    (r) =>
      parseDateTs(r.date) >= windowStartTs &&
      parseDateTs(r.date) >= cpapStartTs &&
      isValidNight(r)
  );
  const bradyNights = eligibleNights.filter((r) => isBradycardiaAlert(r.minHr));
  const lowSpo2Nights = eligibleNights.filter(
    (r) => r.spo2Min != null && r.spo2Min < 85
  );
  const hasAlert = bradyNights.length > 0 || lowSpo2Nights.length > 0;

  // ⚠️データ欠落：最新レコード日が現在地TZの今日から ALERT_GAP_DAYS 日以上離れている（[12]）
  const latestDateStr = latest.date;
  const todayStr = todayInTz(locTz, new Date());
  const gapDays = diffDaysIso(todayStr, latestDateStr);
  const gapAlert = gapDays >= ALERT_GAP_DAYS;

  // [21] CPAPコンプライアンス（直近30日・4h以上）。使用時間列が無ければ総睡眠で代理。
  const compWindowStart = latestTs - COMPLIANCE_WINDOW_DAYS * DAY_MS;
  const compNights = cpap.filter((r) => parseDateTs(r.date) >= compWindowStart);
  const compUsed = compNights.filter((r) => nightUsedFourHours(r).used).length;
  const compReal = compNights.some((r) => r.usageHours != null);
  const compPct =
    compNights.length > 0
      ? Math.round((compUsed / compNights.length) * 100)
      : 0;

  // 数値サマリー（トレンドタブの代替）：直近7日/30日の平均AHI（機内蔵Events/hr）と平均使用時間。
  const recent7 = cpap.filter(
    (r) =>
      parseDateTs(r.date) >= latestTs - RECENT7_DAYS * DAY_MS && isValidNight(r)
  );
  const recent30 = cpap.filter(
    (r) =>
      parseDateTs(r.date) >= latestTs - RECENT30_DAYS * DAY_MS && isValidNight(r)
  );
  const ahi7 = avgOf(recent7, "events");
  const ahi30 = avgOf(recent30, "events");
  const usage30 = avgOf(recent30, "usageHours");

  // [OSCAR] 表示のみのフォールバック。DB-Aの各夜レコードは一切変更しない。
  const hasOwnOscar = latestValid?.oscarAhi != null;
  const latestOscarNight: CpapRow | null = hasOwnOscar
    ? null
    : [...cpap]
        .sort((a, b) => parseDateTs(b.date) - parseDateTs(a.date))
        .find((r) => r.oscarAhi != null) ?? null;
  const oscarNight: CpapRow | null = hasOwnOscar ? latestValid : latestOscarNight;
  const oscarIsFallback = !hasOwnOscar && oscarNight != null;
  const oscarValueLabel = oscarIsFallback ? "実測" : "当夜";

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
    oscarNight?.press95 != null ? CPAP_PRESSURE_MAX - oscarNight.press95 : null;

  return (
    <div className="space-y-6">
      {/* データ欠損の注記（欠損日を未使用日と区別） */}
      <DataGapNote />

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

      {/* 数値サマリー（AHI・使用時間） */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-300">
          睡眠サマリー（AHI・使用時間）
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCell
            label="直近7日 平均AHI"
            value={ahi7 != null ? fmt1(ahi7) : "—"}
            sub={`有効夜 n=${recent7.length}`}
            level={levelEvents(ahi7)}
          />
          <StatCell
            label="直近30日 平均AHI"
            value={ahi30 != null ? fmt1(ahi30) : "—"}
            sub={`有効夜 n=${recent30.length}`}
            level={levelEvents(ahi30)}
          />
          <StatCell
            label="平均使用時間"
            value={usage30 != null ? `${fmt1(usage30)}h` : "—"}
            sub={usage30 != null ? "直近30日" : "使用時間(h)列 未投入"}
          />
        </div>
        <p className="mt-1 text-[11px] text-gray-600">
          ※ AHIは機内蔵Events/hr（有効夜平均）。日々の傾向確認用の参考値です。
        </p>
      </section>

      {/* 最新有効夜のフル評価カード */}
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
          </>
        ) : (
          <EmptyState
            icon="🌙"
            title="有効夜がまだありません"
            hint="総睡眠4h以上かつ睡眠段階の記録がある夜が追加されると、最新有効夜のフル評価がここに表示されます。"
          />
        )}
      </section>

      {/* 次回タスク・通院（Notion E. 次回タスク DB連動）。空ならセクションごと非表示 */}
      {tasks.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-300">
            次回タスク / 通院
          </h2>
          <ul className="space-y-2">
            {tasks.map((t, i) => (
              <li
                key={i}
                className="rounded-lg border border-gray-800 bg-[#161616] px-4 py-3 text-base"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    {priorityLead(t.priority) && (
                      <span className="shrink-0 leading-6">
                        {priorityLead(t.priority)}
                      </span>
                    )}
                    <div>
                      <div className="font-medium text-gray-100">
                        {t.title}
                        {t.status === "進行中" && (
                          <span className="ml-2 rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-normal text-sky-300">
                            進行中
                          </span>
                        )}
                      </div>
                      {t.detail && (
                        <p className="mt-0.5 text-xs text-gray-400">
                          {t.detail}
                        </p>
                      )}
                      {t.contact && (
                        <p className="mt-0.5 text-[11px] text-gray-500">
                          📞 {t.contact}
                        </p>
                      )}
                    </div>
                  </div>
                  {t.due && (
                    <span className="shrink-0 text-xs text-gray-400">
                      期限 {mdFormat(t.due)}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* [21] CPAPコンプライアンス（保険要件・代理値）— 下部に小さく表示。誤用防止の注記を維持。 */}
      <p className="rounded-lg border border-gray-800 bg-[#141414] px-3 py-2 text-[11px] text-gray-500">
        CPAPコンプライアンス{compReal ? "（実測）" : "（代理）"}：
        <span className="font-semibold text-gray-300">{compPct}%</span>（
        {compUsed}/{compNights.length}夜が4h以上・直近{COMPLIANCE_WINDOW_DAYS}日）。
        {compReal
          ? "使用時間(h)列に基づく判定。"
          : "総睡眠(h)ベースの代理値。正式な保険要件提示には使用時間(h)列が必要。"}
      </p>

      {/* 運用注記：アプリ内/外の境界 */}
      <p className="rounded-lg border border-gray-800 bg-[#141414] px-3 py-2 text-[11px] text-gray-500">
        ℹ️ 運用メモ：myAir画像 →数値抽出 → DB追記は<strong className="text-gray-400">チャット経由</strong>で行います（アプリ内完結ではありません）。本ダッシュボードはNotionに入った数値の閲覧・分析専用です。
      </p>
    </div>
  );
}
