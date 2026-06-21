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
import { BLOOD_GUIDE, type BloodGuide } from "@/lib/constants";
import { LEVEL_BADGE } from "@/lib/health";

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

/** 年月日まで揃った完全な日付か（年月のみのレコードは前回比に使わない） */
const isFullDate = (s: string) => /^\d{4}[-/]\d{2}[-/]\d{2}$/.test(s);

/** 項目ごとの評価カード（日本語名・意味・基準値・最新評価・前回比） */
function BloodItemCard({
  guide,
  value,
  valueDate,
  check,
  prevDiff,
}: {
  guide: BloodGuide;
  value: number | null;
  valueDate: string | null;
  check?: BloodKey;
  prevDiff: number | null;
}) {
  // 評価バッジ：lib/health.ts の bloodAbnormal を流用（新規しきい値を定義しない）
  let badgeClass = LEVEL_BADGE.none;
  let badgeText = "—";
  if (value != null) {
    if (check) {
      const abnormal = bloodAbnormal[check](value);
      badgeClass = abnormal ? LEVEL_BADGE.red : LEVEL_BADGE.green;
      badgeText = abnormal ? "🔴 基準外" : "🟢 正常";
    } else {
      badgeText = "中立"; // 基準が無い項目（TSH等）
    }
  }

  // 前回比の矢印（増減の良し悪しは項目で逆になるため色は付けず中立表示）
  let trend = "—";
  if (prevDiff != null) {
    const arrow = prevDiff > 0 ? "↑" : prevDiff < 0 ? "↓" : "→";
    const sign = prevDiff > 0 ? "+" : "";
    trend = prevDiff === 0 ? "→ 0" : `${arrow} ${sign}${formatNum(prevDiff)}`;
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-[#161616] p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-gray-200">{guide.name}</span>
        <span
          className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium ${badgeClass}`}
        >
          {badgeText}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-gray-500">{guide.desc}</p>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-400">
        <span>基準：{guide.ref}</span>
        <span className="text-gray-200">
          最新：{formatNum(value)}
          {valueDate && <span className="text-gray-500">（{valueDate}）</span>}
        </span>
        <span>前回比：{trend}</span>
      </div>
    </div>
  );
}

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
      {/* 項目別サマリー：日本語名・意味・基準値・最新評価・前回比（最新採血から動的） */}
      <section>
        <h3 className="mb-1 text-sm font-semibold text-gray-300">
          項目別サマリー（最新採血の評価）
        </h3>
        <p className="mb-3 text-[11px] text-gray-600">
          ※ 各評価は一般的な基準値に基づく参考表示で、診断ではありません。医学的判断は主治医（相馬先生）に委ねてください。
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {COLUMNS.map((c) => {
            const guide = BLOOD_GUIDE[c.key as string];
            if (!guide) return null;
            // 最新値＝降順で最初に非nullの採血値（その採血日も保持）
            const latestRow = desc.find((r) => (r[c.key] as number | null) != null);
            const value = latestRow ? (latestRow[c.key] as number | null) : null;
            const valueDate = latestRow ? latestRow.date : null;
            // 前回比＝完全日付かつ非nullの直近2件で比較（年月のみは除外）
            const fullVals = desc
              .filter((r) => isFullDate(r.date) && (r[c.key] as number | null) != null)
              .map((r) => r[c.key] as number);
            const prevDiff =
              fullVals.length >= 2 ? fullVals[0] - fullVals[1] : null;
            return (
              <BloodItemCard
                key={c.key as string}
                guide={guide}
                value={value}
                valueDate={valueDate}
                check={c.check}
                prevDiff={prevDiff}
              />
            );
          })}
        </div>
      </section>

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
