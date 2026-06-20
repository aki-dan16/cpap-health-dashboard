"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { BloodRow } from "@/lib/types";
import EmptyState from "./EmptyState";
import { bloodAbnormal, parseDateTs, formatNum } from "@/lib/health";

type BloodKey = keyof typeof bloodAbnormal;

const COLUMNS: { key: keyof BloodRow; label: string; check?: BloodKey }[] = [
  { key: "alt", label: "ALT", check: "alt" },
  { key: "ast", label: "AST", check: "ast" },
  { key: "glucose", label: "Glucose", check: "glucose" },
  { key: "hba1c", label: "HbA1c", check: "hba1c" },
  { key: "tg", label: "TG", check: "tg" },
  { key: "ldl", label: "LDL", check: "ldl" },
  { key: "hdl", label: "HDL", check: "hdl" },
  { key: "egfr", label: "eGFR", check: "egfr" },
  { key: "ggt", label: "GGT", check: "ggt" },
  { key: "vitd", label: "VitD", check: "vitd" },
  { key: "tsh", label: "TSH" },
];

export default function BloodTab({ blood }: { blood: BloodRow[] }) {
  if (blood.length === 0) {
    return (
      <EmptyState
        icon="🩸"
        title="血液検査データがありません"
        hint="Notion DB-B（血液検査）に検査値を追加すると、時系列テーブルとALT推移がここに表示されます。"
      />
    );
  }

  // 表示は日付降順、グラフは昇順
  const desc = [...blood].sort(
    (a, b) => parseDateTs(b.date) - parseDateTs(a.date)
  );
  const asc = [...blood].sort(
    (a, b) => parseDateTs(a.date) - parseDateTs(b.date)
  );

  const th = "px-3 py-2 text-xs font-semibold text-gray-400 whitespace-nowrap";
  const td = "px-3 py-2 text-sm whitespace-nowrap text-center";

  const altData = asc.map((r) => ({ date: r.date, value: r.alt }));

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full min-w-[860px]">
          <thead className="bg-[#1a1a1a]">
            <tr>
              <th className={`${th} text-left`}>日付</th>
              {COLUMNS.map((c) => (
                <th key={c.key as string} className={th}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {desc.map((r, i) => (
              <tr key={i} className="hover:bg-[#161616]">
                <td className={`${td} text-left font-medium text-gray-200`}>
                  {r.date}
                </td>
                {COLUMNS.map((c) => {
                  const v = r[c.key] as number | null;
                  const abnormal = c.check ? bloodAbnormal[c.check](v) : false;
                  return (
                    <td
                      key={c.key as string}
                      className={`${td} ${
                        abnormal
                          ? "font-bold text-red-400"
                          : "text-gray-200"
                      }`}
                    >
                      {formatNum(v)}
                      {abnormal && " 🔴"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-gray-800 bg-[#161616] p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-300">
          ALT推移（目標ライン 58）
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={altData}
              margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis
                dataKey="date"
                tick={{ fill: "#888", fontSize: 11 }}
                stroke="#444"
              />
              <YAxis
                tick={{ fill: "#888", fontSize: 11 }}
                stroke="#444"
                domain={["auto", "auto"]}
              />
              <Tooltip
                contentStyle={{
                  background: "#1a1a1a",
                  border: "1px solid #333",
                  borderRadius: 8,
                  color: "#eee",
                }}
                labelStyle={{ color: "#aaa" }}
              />
              <ReferenceLine
                y={58}
                stroke="#ef4444"
                strokeDasharray="5 4"
                label={{
                  value: "目標 58",
                  fill: "#ef4444",
                  fontSize: 11,
                  position: "insideTopRight",
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                name="ALT"
                stroke="#fbbf24"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <p className="text-xs text-gray-600">
        基準値外の判定：ALT&gt;58 / AST&gt;43 / Glucose&gt;99 / HbA1c&gt;5.7 / TG&gt;150 /
        LDL&gt;100 / HDL&lt;39 / eGFR&lt;89 / GGT&gt;72 / VitD&lt;30 または &gt;100
      </p>
    </div>
  );
}
