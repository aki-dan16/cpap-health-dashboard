"use client";

import { useMemo, useState } from "react";
import type { CpapRow } from "@/lib/types";
import EmptyState from "./EmptyState";
import { withNightTz, nightTz } from "@/lib/tz";
import {
  LEVEL_TEXT,
  levelSeal,
  levelEvents,
  levelSpo2Min,
  parseDateTs,
  isValidNight,
  fmtInt,
  fmt1,
  SPO2_MIN_NOTE,
} from "@/lib/health";

type Period = "all" | "pre" | "s" | "mw";
type TzFilter = "all" | "HST" | "PST" | "PDT" | "JST";
type Sort = "desc" | "asc";

function inPeriod(date: string, period: Period): boolean {
  if (period === "all") return true;
  if (period === "pre") return date <= "2026-04-30";
  if (period === "s") return date >= "2026-05-01" && date <= "2026-06-10";
  return date >= "2026-06-11"; // mw
}

export default function HistoryTab({ cpap }: { cpap: CpapRow[] }) {
  const [period, setPeriod] = useState<Period>("all");
  const [validOnly, setValidOnly] = useState(false);
  const [tzFilter, setTzFilter] = useState<TzFilter>("all");
  const [sort, setSort] = useState<Sort>("desc");

  const rows = useMemo(() => {
    const filtered = cpap.filter(
      (r) =>
        inPeriod(r.date, period) &&
        (!validOnly || isValidNight(r)) &&
        (tzFilter === "all" || nightTz(r.tz) === tzFilter)
    );
    return filtered.sort((a, b) =>
      sort === "desc"
        ? parseDateTs(b.date) - parseDateTs(a.date)
        : parseDateTs(a.date) - parseDateTs(b.date)
    );
  }, [cpap, period, validOnly, tzFilter, sort]);

  if (cpap.length === 0) {
    return (
      <EmptyState
        icon="📋"
        title="履歴データがありません"
        hint="Notion DB-A（CPAP夜ログ）に記録を追加すると、全履歴がこの表に並びます。"
      />
    );
  }

  const th = "px-3 py-2 text-xs font-semibold text-gray-400 whitespace-nowrap";
  const td = "px-3 py-2 text-sm text-gray-200 whitespace-nowrap";
  const ctrl =
    "rounded-md border border-gray-700 bg-[#161616] px-2 py-1 text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-sky-500";

  return (
    <div className="space-y-3">
      {/* [42] フィルタ／ソート */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as Period)}
          className={ctrl}
          aria-label="期間フィルタ"
        >
          <option value="all">全期間</option>
          <option value="pre">CPAP前 (〜4/30)</option>
          <option value="s">S期 (5/1〜6/10)</option>
          <option value="mw">MW期 (6/11〜)</option>
        </select>
        <select
          value={tzFilter}
          onChange={(e) => setTzFilter(e.target.value as TzFilter)}
          className={ctrl}
          aria-label="TZフィルタ"
        >
          <option value="all">全TZ</option>
          <option value="HST">HST</option>
          <option value="PST">PST</option>
          <option value="PDT">PDT</option>
          <option value="JST">JST</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className={ctrl}
          aria-label="並び替え"
        >
          <option value="desc">日付：新しい順</option>
          <option value="asc">日付：古い順</option>
        </select>
        <label className="flex items-center gap-1 text-xs text-gray-400">
          <input
            type="checkbox"
            checked={validOnly}
            onChange={(e) => setValidOnly(e.target.checked)}
            className="accent-sky-500"
          />
          有効夜のみ
        </label>
        <span className="ml-auto text-xs text-gray-500">{rows.length} 件</span>
      </div>

      <p className="text-[11px] text-gray-600">
        ※ 睡眠帯の時刻はその夜のTZ基準で表示。* 印は{SPO2_MIN_NOTE}
      </p>

      {rows.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="条件に一致する夜がありません"
          hint="期間・TZ・有効夜フィルタを緩めてください。"
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full min-w-[960px]">
            <thead className="bg-[#1a1a1a]">
              <tr>
                <th className={`${th} text-left`}>日付</th>
                <th className={th}>TZ</th>
                <th className={`${th} text-left`}>睡眠帯</th>
                <th className={th}>Seal</th>
                <th className={th}>Events</th>
                <th className={th}>深睡眠</th>
                <th className={th}>総睡眠</th>
                <th className={th}>SpO2平均</th>
                <th className={th} title={SPO2_MIN_NOTE}>
                  SpO2最低<span className="text-gray-600">*</span>
                </th>
                <th className={th} title="睡眠中最低心拍（CPAP感受指標）">
                  最低心拍
                </th>
                <th className={th} title="日次RHR（24時間・減量待ち指標）">
                  日次RHR
                </th>
                <th className={`${th} text-left`}>体感メモ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-[#161616]">
                  <td className={`${td} text-left font-medium`}>{r.date}</td>
                  <td className={`${td} text-center text-gray-500`}>
                    {nightTz(r.tz)}
                  </td>
                  <td className={`${td} text-left text-gray-400`}>
                    {r.sleepBand ? withNightTz(r.sleepBand, r.tz) : "—"}
                  </td>
                  <td className={`${td} text-center ${LEVEL_TEXT[levelSeal(r.seal)]}`}>
                    {fmtInt(r.seal)}
                  </td>
                  <td
                    className={`${td} text-center ${LEVEL_TEXT[levelEvents(r.events)]}`}
                  >
                    {fmt1(r.events)}
                  </td>
                  <td className={`${td} text-center`}>{fmtInt(r.deepSleep)}</td>
                  <td className={`${td} text-center`}>{fmt1(r.totalSleep)}</td>
                  <td className={`${td} text-center`}>{fmt1(r.spo2Avg)}</td>
                  <td
                    className={`${td} text-center ${LEVEL_TEXT[levelSpo2Min(r.spo2Min)]}`}
                  >
                    {fmtInt(r.spo2Min)}
                  </td>
                  <td
                    className={`${td} text-center ${
                      r.minHr != null && r.minHr < 40
                        ? "font-bold text-red-400"
                        : ""
                    }`}
                  >
                    {fmtInt(r.minHr)}
                  </td>
                  <td className={`${td} text-center`}>{fmtInt(r.rhr)}</td>
                  <td
                    className={`${td} max-w-[220px] truncate text-left text-gray-400`}
                  >
                    {r.memo || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
