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
import type { CpapRow } from "@/lib/types";
import EmptyState from "./EmptyState";
import { parseDateTs, isValidNight, SPO2_MIN_NOTE } from "@/lib/health";

interface ChartDef {
  key: keyof CpapRow;
  title: string;
  color: string;
  note?: string;
  target?: { value: number; label: string };
}

// [08] 日次RHR と 睡眠中最低心拍 は別チャート・別系列として明確に分離
const CHARTS: ChartDef[] = [
  {
    key: "spo2Min",
    title: "SpO2最低 (%)",
    color: "#38bdf8",
    target: { value: 90, label: "目標 90%" },
    note: SPO2_MIN_NOTE,
  },
  {
    key: "minHr",
    title: "睡眠中最低心拍 (bpm)",
    color: "#f472b6",
    note: "CPAP感受指標（睡眠中）。日次RHRとは別物。",
  },
  {
    key: "rhr",
    title: "日次RHR (bpm)",
    color: "#fb923c",
    note: "24時間・減量待ち指標。睡眠中最低心拍とは別系列。",
  },
  {
    key: "totalSleep",
    title: "総睡眠 (h)",
    color: "#a78bfa",
    target: { value: 6, label: "目標 6h" },
  },
  {
    key: "deepSleep",
    title: "深睡眠 (分)", // [07] 絶対分で固定（％混入なし）
    color: "#34d399",
    target: { value: 30, label: "目標 30分" },
  },
  { key: "seal", title: "Seal", color: "#fbbf24" },
  { key: "events", title: "Events/hr", color: "#fb7185" },
];

interface Point {
  date: string;
  value: number | null; // 有効夜の値（集計対象）
  invalid: number | null; // 無効夜の値（表示のみ・集計外）
}

function TrendChart({ data, def }: { data: Point[]; def: ChartDef }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-[#161616] p-4">
      <h3 className="text-sm font-semibold text-gray-300">{def.title}</h3>
      {def.note && <p className="mb-2 text-[11px] text-gray-500">{def.note}</p>}
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
            <Legend wrapperStyle={{ fontSize: 11, color: "#aaa" }} />
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
              name="有効夜"
              stroke={def.color}
              strokeWidth={2}
              dot={{ r: 2 }}
              connectNulls
            />
            {/* [05] 無効夜：点は残すが線・集計に入れない（グレー×マーカー） */}
            <Line
              type="monotone"
              dataKey="invalid"
              name="無効夜(集計外)"
              stroke="transparent"
              legendType="cross"
              dot={{ r: 3, fill: "#6b7280", stroke: "#6b7280" }}
              activeDot={false}
              connectNulls={false}
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
      <EmptyState
        icon="📈"
        title="トレンド表示用のデータがありません"
        hint="Notion DB-A に夜の記録が増えると、各指標の推移グラフがここに描画されます。"
      />
    );
  }

  const sorted = [...cpap].sort(
    (a, b) => parseDateTs(a.date) - parseDateTs(b.date)
  );

  return (
    <div>
      <p className="mb-3 text-xs text-gray-500">
        🔵 有効夜（総睡眠≥4h・段階記録あり）を集計対象とし、
        <span className="text-gray-400">グレー点＝無効夜（集計外）</span>
        として区別表示しています。
      </p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {CHARTS.map((def) => {
          const data: Point[] = sorted.map((r) => {
            const valid = isValidNight(r);
            const v = r[def.key] as number | null;
            return {
              date: r.date,
              value: valid ? v : null,
              invalid: valid ? null : v,
            };
          });
          return <TrendChart key={def.key as string} data={data} def={def} />;
        })}
      </div>
    </div>
  );
}
