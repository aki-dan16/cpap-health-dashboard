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
  ReferenceArea,
  Legend,
  ScatterChart,
  Scatter,
  BarChart,
  Bar,
} from "recharts";
import type { CpapRow } from "@/lib/types";
import EmptyState from "./EmptyState";
import { parseDateTs, isValidNight, SPO2_MIN_NOTE } from "@/lib/health";
import { MASK_BANDS, EVENT_ANNOTATIONS } from "@/lib/constants";

const MA_WINDOW = 7; // [15] 移動平均の窓（有効夜サンプル数ベース）

interface ChartDef {
  key: keyof CpapRow;
  title: string;
  color: string;
  note?: string;
  target?: { value: number; label: string }; // 目標ライン（緑）
  threshold?: { value: number; label: string }; // [16] 閾値ライン（琥珀）
  ma?: boolean; // [15] 移動平均オーバーレイ
}

const CHARTS: ChartDef[] = [
  {
    key: "spo2Min",
    title: "SpO2最低 (%)",
    color: "#38bdf8",
    target: { value: 90, label: "目標/閾値 90%" }, // [16] SpO2最低=90
    note: SPO2_MIN_NOTE,
    ma: true,
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
    title: "深睡眠 (分)",
    color: "#34d399",
    target: { value: 30, label: "目標/閾値 30分" }, // [16] 深睡眠=30
    ma: true,
  },
  {
    key: "seal",
    title: "Seal",
    color: "#fbbf24",
    threshold: { value: 8, label: "閾値 8" }, // [16] Seal=8
    ma: true,
  },
  {
    key: "events",
    title: "Events/hr",
    color: "#fb7185",
    threshold: { value: 5, label: "閾値 5" }, // [16] Events/hr=5
    ma: true,
  },
];

// [22] HRV・呼吸数（DB-Aに列がある場合のみ表示）
const PHASE2_CHARTS: ChartDef[] = [
  {
    key: "hrv",
    title: "HRV (ms)",
    color: "#22d3ee",
    note: "Apple Health由来。DB-Aの「HRV(ms)」列にデータが入ると表示。",
    ma: true,
  },
  {
    key: "respRate",
    title: "呼吸数 (/min)",
    color: "#c084fc",
    note: "DB-Aの「呼吸数」列にデータが入ると表示。",
  },
];

interface Point {
  date: string;
  value: number | null; // 有効夜（集計対象）
  invalid: number | null; // 無効夜（表示のみ・集計外）
  ma: number | null; // 移動平均（有効夜のみ）
}

/** 指定範囲に実在する最初/最後の日付（カテゴリ軸のReferenceArea用） */
function bandBounds(
  dates: string[],
  start?: string,
  end?: string
): { x1: string; x2: string } | null {
  const inRange = dates.filter(
    (d) => (!start || d >= start) && (!end || d <= end)
  );
  if (inRange.length === 0) return null;
  return { x1: inRange[0], x2: inRange[inRange.length - 1] };
}

/** 有効夜サンプルの後方移動平均（無効夜はnull＝集計外） — [15] */
function movingAvg(
  pts: { valid: boolean; v: number | null }[],
  window: number
): (number | null)[] {
  const trailing: number[] = [];
  return pts.map((p) => {
    if (!p.valid || p.v == null) return null;
    trailing.push(p.v);
    if (trailing.length > window) trailing.shift();
    return trailing.reduce((a, b) => a + b, 0) / trailing.length;
  });
}

function TrendChart({
  data,
  def,
  dates,
  annotations,
}: {
  data: Point[];
  def: ChartDef;
  dates: string[];
  annotations: { date: string; label: string }[];
}) {
  const dateSet = new Set(dates);
  return (
    <div className="rounded-xl border border-gray-800 bg-[#161616] p-4">
      <h3 className="text-sm font-semibold text-gray-300">{def.title}</h3>
      {def.note && <p className="mb-2 text-[11px] text-gray-500">{def.note}</p>}
      <div className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            {/* [14] マスク期バンド */}
            {MASK_BANDS.map((b) => {
              const bb = bandBounds(dates, b.start, b.end);
              if (!bb) return null;
              return (
                <ReferenceArea
                  key={b.label}
                  x1={bb.x1}
                  x2={bb.x2}
                  fill={b.color}
                  fillOpacity={0.06}
                  label={{
                    value: b.label,
                    position: "insideTop",
                    fill: b.color,
                    fontSize: 10,
                  }}
                />
              );
            })}
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

            {/* [16] 目標/閾値ライン */}
            {def.target && (
              <ReferenceLine
                y={def.target.value}
                stroke="#10b981"
                strokeDasharray="5 4"
                label={{
                  value: def.target.label,
                  fill: "#10b981",
                  fontSize: 10,
                  position: "insideTopRight",
                }}
              />
            )}
            {def.threshold && (
              <ReferenceLine
                y={def.threshold.value}
                stroke="#f59e0b"
                strokeDasharray="5 4"
                label={{
                  value: def.threshold.label,
                  fill: "#f59e0b",
                  fontSize: 10,
                  position: "insideTopRight",
                }}
              />
            )}

            {/* [17] イベント注釈（実在日付のみ） */}
            {annotations
              .filter((a) => dateSet.has(a.date))
              .map((a, i) => (
                <ReferenceLine
                  key={`${a.date}-${i}`}
                  x={a.date}
                  stroke="#a1a1aa"
                  strokeDasharray="2 3"
                  label={{
                    value: a.label,
                    fill: "#a1a1aa",
                    fontSize: 9,
                    position: "top",
                  }}
                />
              ))}

            {/* 有効夜の実測線 */}
            <Line
              type="monotone"
              dataKey="value"
              name="有効夜"
              stroke={def.color}
              strokeWidth={2}
              dot={{ r: 2 }}
              connectNulls
            />
            {/* [15] 7日移動平均（無効夜除外後） */}
            {def.ma && (
              <Line
                type="monotone"
                dataKey="ma"
                name={`${MA_WINDOW}日移動平均`}
                stroke="#94a3b8"
                strokeWidth={1.5}
                strokeDasharray="6 3"
                dot={false}
                connectNulls
              />
            )}
            {/* [05] 無効夜（集計外・グレー点） */}
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

export default function TrendTab({
  cpap,
  bloodDates = [],
}: {
  cpap: CpapRow[];
  bloodDates?: string[];
}) {
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
  const dates = sorted.map((r) => r.date);

  // [22] HRV/呼吸数は列にデータがある場合のみチャートを追加
  const activeCharts = [
    ...CHARTS,
    ...PHASE2_CHARTS.filter((def) =>
      sorted.some((r) => (r[def.key] as number | null) != null)
    ),
  ];

  // [17] 静的イベント＋採血日(DB-B)を注釈に統合
  const annotations = [
    ...EVENT_ANNOTATIONS,
    ...bloodDates.map((d) => ({ date: d, label: "採血" })),
  ];

  return (
    <div>
      <p className="mb-3 text-xs text-gray-500">
        🔵 有効夜（総睡眠≥4h・段階記録あり）を集計対象、
        <span className="text-gray-400">グレー点＝無効夜（集計外）</span>、
        破線＝{MA_WINDOW}日移動平均。背景バンド＝マスク期、縦破線＝イベント。
      </p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {activeCharts.map((def) => {
          const pts = sorted.map((r) => ({
            r,
            valid: isValidNight(r),
            v: r[def.key] as number | null,
          }));
          const ma = def.ma
            ? movingAvg(
                pts.map((p) => ({ valid: p.valid, v: p.v })),
                MA_WINDOW
              )
            : null;
          const data: Point[] = pts.map((p, i) => ({
            date: p.r.date,
            value: p.valid ? p.v : null,
            invalid: p.valid ? null : p.v,
            ma: ma ? ma[i] : null,
          }));
          return (
            <TrendChart
              key={def.key as string}
              data={data}
              def={def}
              dates={dates}
              annotations={annotations}
            />
          );
        })}
      </div>

      {/* [25] 体位 ↔ Events/hr 対比 */}
      <PositionEventsView cpap={sorted} />

      {/* [20] Seal ↔ Events/hr 相関（有効夜のみ） */}
      <SealEventsScatter cpap={sorted} />
    </div>
  );
}

function PositionEventsView({ cpap }: { cpap: CpapRow[] }) {
  // 有効夜・体位/Events が揃う夜のみ集計
  const rows = cpap.filter(
    (r) => isValidNight(r) && r.position != null && r.events != null
  );

  if (rows.length === 0) {
    return (
      <div className="mt-4">
        <EmptyState
          icon="🛏️"
          title="体位データが未収集です"
          hint="DB-Aに「体位」列（側臥位/仰臥位/腹臥位）を追加して記録すると、体位ごとのEvents/hr差がここに表示されます（無呼吸の体位差は最大の自己最適化レバー）。"
        />
      </div>
    );
  }

  const groups = new Map<string, { sum: number; n: number }>();
  for (const r of rows) {
    const g = groups.get(r.position as string) ?? { sum: 0, n: 0 };
    g.sum += r.events as number;
    g.n += 1;
    groups.set(r.position as string, g);
  }
  const data = Array.from(groups.entries()).map(([position, g]) => ({
    position,
    avgEvents: +(g.sum / g.n).toFixed(1),
    n: g.n,
  }));

  return (
    <div className="mt-4 rounded-xl border border-gray-800 bg-[#161616] p-4">
      <h3 className="text-sm font-semibold text-gray-300">
        体位 ↔ Events/hr（有効夜・平均）
      </h3>
      <p className="mb-2 text-[11px] text-gray-500">
        体位ごとの平均Events/hr。低いほどその体位で無呼吸が少ない。
      </p>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
            <XAxis dataKey="position" tick={{ fill: "#888", fontSize: 11 }} stroke="#444" />
            <YAxis tick={{ fill: "#888", fontSize: 11 }} stroke="#444" />
            <Tooltip
              contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, color: "#eee" }}
              labelStyle={{ color: "#aaa" }}
            />
            <ReferenceLine y={5} stroke="#f59e0b" strokeDasharray="5 4" label={{ value: "閾値 5", fill: "#f59e0b", fontSize: 10, position: "insideTopRight" }} />
            <Bar dataKey="avgEvents" name="平均Events/hr" fill="#fb7185" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-[11px] text-gray-600">
        n（夜数）：{data.map((d) => `${d.position}=${d.n}`).join(" / ")}
      </p>
    </div>
  );
}

function SealEventsScatter({ cpap }: { cpap: CpapRow[] }) {
  const points = cpap
    .filter((r) => isValidNight(r) && r.seal != null && r.events != null)
    .map((r) => ({ seal: r.seal as number, events: r.events as number, date: r.date }));

  if (points.length === 0) return null;

  return (
    <div className="mt-4 rounded-xl border border-gray-800 bg-[#161616] p-4">
      <h3 className="text-sm font-semibold text-gray-300">
        Seal ↔ Events/hr 相関
      </h3>
      <p className="mb-2 text-[11px] text-gray-500">
        有効夜のみ。シール性（Seal）が高いほど無呼吸イベントが減るかを確認（有効性ドライバー）。
      </p>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
            <XAxis
              type="number"
              dataKey="seal"
              name="Seal"
              tick={{ fill: "#888", fontSize: 11 }}
              stroke="#444"
              domain={["auto", "auto"]}
              label={{ value: "Seal", position: "insideBottom", fill: "#888", fontSize: 11, dy: 10 }}
            />
            <YAxis
              type="number"
              dataKey="events"
              name="Events/hr"
              tick={{ fill: "#888", fontSize: 11 }}
              stroke="#444"
              domain={["auto", "auto"]}
            />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              contentStyle={{
                background: "#1a1a1a",
                border: "1px solid #333",
                borderRadius: 8,
                color: "#eee",
              }}
              labelStyle={{ color: "#aaa" }}
            />
            <ReferenceLine x={8} stroke="#f59e0b" strokeDasharray="5 4" label={{ value: "Seal 8", fill: "#f59e0b", fontSize: 10, position: "top" }} />
            <ReferenceLine y={5} stroke="#f59e0b" strokeDasharray="5 4" label={{ value: "Events 5", fill: "#f59e0b", fontSize: 10, position: "right" }} />
            <Scatter data={points} name="有効夜" fill="#38bdf8" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
