"use client";

import type { CpapRow } from "@/lib/types";
import EmptyState from "./EmptyState";
import { withNightTz } from "@/lib/tz";
import {
  LEVEL_TEXT,
  levelSeal,
  levelEvents,
  levelSpo2Min,
  parseDateTs,
  fmtInt,
  fmt1,
  SPO2_MIN_NOTE,
} from "@/lib/health";

export default function HistoryTab({ cpap }: { cpap: CpapRow[] }) {
  if (cpap.length === 0) {
    return (
      <EmptyState
        icon="📋"
        title="履歴データがありません"
        hint="Notion DB-A（CPAP夜ログ）に記録を追加すると、全履歴がこの表に並びます。"
      />
    );
  }

  // 日付降順
  const rows = [...cpap].sort(
    (a, b) => parseDateTs(b.date) - parseDateTs(a.date)
  );

  const th = "px-3 py-2 text-xs font-semibold text-gray-400 whitespace-nowrap";
  const td = "px-3 py-2 text-sm text-gray-200 whitespace-nowrap";

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-800">
      <table className="w-full min-w-[900px]">
        <thead className="bg-[#1a1a1a]">
          <tr>
            <th className={`${th} text-left`}>日付</th>
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
                  r.minHr != null && r.minHr < 40 ? "font-bold text-red-400" : ""
                }`}
              >
                {fmtInt(r.minHr)}
              </td>
              <td className={`${td} text-center`}>{fmtInt(r.rhr)}</td>
              <td className={`${td} max-w-[220px] truncate text-left text-gray-400`}>
                {r.memo || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
