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
import type { CpapRow } from "@/lib/types";
import { parseDateTs } from "@/lib/health";

interface ChartDef {
  key: keyof CpapRow;
  title: string;
  color: string;
  unit?: string;
  target?: { value: number; label: string };
}

const CHARTS: ChartDef[] = [
  {
    key: "spo2Min",
    title: "SpO2最低 (%)",
    color: "#38bdf8",
    unit: "%",
    target: { value: 90, label: "目標 90%" },
  },
  { key: "minHr", title: "睡眠中最低心拍 (bpm)", color: "#f472b6", unit: "bpm" },
  {
    key: "totalSleep",
    title: "総睡眠 (h)",
    color: "#a78bfa",
    unit: "h",
    target: { value: 6, label: "目標 6h" },
  },
  {
    key: "deepSleep",
    title: "深睡眠 (分)",
    color: "#34d399",
    unit: "分",
    target: { value: 30, label: "目標 30分" },
  },
  { key: "seal", title: "Seal", color: "#fbbf24" },
  { key: "events", title: "Events/hr", color: "#fb7185", unit: "/hr" },
];

function TrendChart({
  data,
  def,
}: {
  data: { date: string; value: number | null }[];
  def: ChartDef;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-[#161616] p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-300">{def.title}</h3>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
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
            {def.target && (
              <ReferenceLine
                y={def.target.value}
                stroke="#10b981"
                strokeDasharray="5 4"
                label={{
                  value: def.target.label,
                  fill: "#10b981",
                  fontSize: 11,
                  position: "insideTopRight",
                }}
              />
            )}
            <Line
              type="monotone"
              dataKey="value"
              name={def.title}
              stroke={def.color}
              strokeWidth={2}
              dot={{ r: 2 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function TrendTab({ cpap }: { cpap: CpapRow[] }) {
  if (cpap.length === 0) {
    return (
      <p className="py-10 text-center text-gray-500">CPAPデータがありません。</p>
    );
  }

  const sorted = [...cpap].sort(
    (a, b) => parseDateTs(a.date) - parseDateTs(b.date)
  );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {CHARTS.map((def) => {
        const data = sorted.map((r) => ({
          date: r.date,
          value: r[def.key] as number | null,
        }));
        return <TrendChart key={def.key as string} data={data} def={def} />;
      })}
    </div>
  );
}
