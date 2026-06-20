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
  Legend,
} from "recharts";
import type { WeightRow } from "@/lib/types";
import EmptyState from "./EmptyState";
import { parseDateTs } from "@/lib/health";

interface Point {
  date: string;
  renpho: number | null;
  elation: number | null;
}

export default function WeightTab({ weight }: { weight: WeightRow[] }) {
  const asc = [...weight].sort(
    (a, b) => parseDateTs(a.date) - parseDateTs(b.date)
  );

  // 日付ごとに RENPHO / Elation を集約
  const byDate = new Map<string, Point>();
  for (const r of asc) {
    const p = byDate.get(r.date) ?? {
      date: r.date,
      renpho: null,
      elation: null,
    };
    if (r.source === "RENPHO") p.renpho = r.weight;
    else if (r.source === "Elation") p.elation = r.weight;
    byDate.set(r.date, p);
  }
  const data = Array.from(byDate.values()).sort(
    (a, b) => parseDateTs(a.date) - parseDateTs(b.date)
  );

  return (
    <div className="space-y-6">
      {/* 体重推移グラフ */}
      <div className="rounded-xl border border-gray-800 bg-[#161616] p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-300">
          体重推移（kg）
        </h3>
        {data.length === 0 ? (
          <EmptyState
            icon="⚖️"
            title="体重データがありません"
            hint="Notion DB-C（体重）にRENPHO/Elation等の記録を追加すると、推移グラフが描画されます。"
          />
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
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
                <Legend wrapperStyle={{ fontSize: 12, color: "#aaa" }} />
                <ReferenceLine y={100} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "100kg", fill: "#ef4444", fontSize: 10, position: "insideTopRight" }} />
                <ReferenceLine y={95} stroke="#fbbf24" strokeDasharray="4 4" label={{ value: "95kg", fill: "#fbbf24", fontSize: 10, position: "insideTopRight" }} />
                <ReferenceLine y={85} stroke="#34d399" strokeDasharray="4 4" label={{ value: "85kg", fill: "#34d399", fontSize: 10, position: "insideTopRight" }} />
                <Line
                  type="monotone"
                  dataKey="renpho"
                  name="RENPHO"
                  stroke="#34d399"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="elation"
                  name="Elation"
                  stroke="#9ca3af"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={{ r: 2 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="mt-2 text-xs text-gray-600">
          実線（緑）＝RENPHO / 点線（グレー）＝Elation
        </p>
      </div>

      {/* DXA固定表示 */}
      <div className="rounded-xl border border-gray-800 bg-[#161616] p-4">
        <h3 className="mb-1 text-sm font-semibold text-gray-300">
          DXAスキャン
        </h3>
        <p className="mb-3 text-xs text-gray-500">2025/6/13 時点</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <DxaCell label="体重" value="107.9" unit="kg" />
          <DxaCell label="除脂肪" value="80.4" unit="kg" />
          <DxaCell label="体脂肪" value="25.5" unit="%" />
          <DxaCell label="VAT" value="162" unit="cm²" dot="🔴" tone="text-red-400" />
          <DxaCell label="T-score" value="-1.5" dot="🟡" tone="text-amber-400" />
        </div>
      </div>
    </div>
  );
}

function DxaCell({
  label,
  value,
  unit,
  dot,
  tone,
}: {
  label: string;
  value: string;
  unit?: string;
  dot?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-800 bg-[#1a1a1a] p-3">
      <div className="text-xs text-gray-400">{label}</div>
      <div className={`mt-1 flex items-baseline gap-1 ${tone ?? "text-gray-100"}`}>
        <span className="text-xl font-bold">{value}</span>
        {unit && <span className="text-xs text-gray-400">{unit}</span>}
        {dot && <span className="ml-1">{dot}</span>}
      </div>
    </div>
  );
}
