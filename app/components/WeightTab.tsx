"use client";

import {
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import type { WeightRow, BloodRow } from "@/lib/types";
import EmptyState from "./EmptyState";
import { parseDateTs } from "@/lib/health";

const isFullDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

interface SrcPoint {
  date: string;
  renpho: number | null;
  elation: number | null;
  dxa: number | null;
}

interface CorrPoint {
  date: string;
  weight: number | null;
  alt: number | null;
  ast: number | null;
}

export default function WeightTab({
  weight,
  blood = [],
}: {
  weight: WeightRow[];
  blood?: BloodRow[];
}) {
  const asc = [...weight].sort(
    (a, b) => parseDateTs(a.date) - parseDateTs(b.date)
  );

  // [18] 日付ごとに RENPHO / Elation / DXA を集約（ソース別）
  const byDate = new Map<string, SrcPoint>();
  for (const r of asc) {
    const p = byDate.get(r.date) ?? {
      date: r.date,
      renpho: null,
      elation: null,
      dxa: null,
    };
    if (r.source === "RENPHO") p.renpho = r.weight;
    else if (r.source === "Elation") p.elation = r.weight;
    else if (r.source === "DXA") p.dxa = r.weight;
    byDate.set(r.date, p);
  }
  const data = Array.from(byDate.values()).sort(
    (a, b) => parseDateTs(a.date) - parseDateTs(b.date)
  );

  // [19] 体重 ↔ ALT/AST 二軸時系列。完全日付のみ（部分日付の血液は除外）。
  const corrMap = new Map<string, CorrPoint>();
  for (const r of asc) {
    if (!isFullDate(r.date)) continue;
    const p = corrMap.get(r.date) ?? {
      date: r.date,
      weight: null,
      alt: null,
      ast: null,
    };
    if (r.weight != null) p.weight = r.weight; // ソース問わず体重を採用
    corrMap.set(r.date, p);
  }
  for (const r of blood) {
    if (!isFullDate(r.date)) continue;
    const p = corrMap.get(r.date) ?? {
      date: r.date,
      weight: null,
      alt: null,
      ast: null,
    };
    p.alt = r.alt;
    p.ast = r.ast;
    corrMap.set(r.date, p);
  }
  const corr = Array.from(corrMap.values()).sort(
    (a, b) => parseDateTs(a.date) - parseDateTs(b.date)
  );
  const hasBloodFull = blood.some((r) => isFullDate(r.date));

  const tooltipStyle = {
    background: "#1a1a1a",
    border: "1px solid #333",
    borderRadius: 8,
    color: "#eee",
  };

  return (
    <div className="space-y-6">
      {/* [18] 体重推移（ソース別マーカー・色） */}
      <div className="rounded-xl border border-gray-800 bg-[#161616] p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-300">
          体重推移（kg・ソース別）
        </h3>
        {data.length === 0 ? (
          <EmptyState
            icon="⚖️"
            title="体重データがありません"
            hint="Notion DB-C（体重）にRENPHO/Elation/DXAの記録を追加すると、推移グラフが描画されます。"
          />
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
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
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#aaa" }} />
                <Legend wrapperStyle={{ fontSize: 12, color: "#aaa" }} />
                <ReferenceLine y={100} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "100kg", fill: "#ef4444", fontSize: 10, position: "insideTopRight" }} />
                <ReferenceLine y={95} stroke="#fbbf24" strokeDasharray="4 4" label={{ value: "95kg", fill: "#fbbf24", fontSize: 10, position: "insideTopRight" }} />
                <ReferenceLine y={85} stroke="#34d399" strokeDasharray="4 4" label={{ value: "85kg", fill: "#34d399", fontSize: 10, position: "insideTopRight" }} />
                {/* トレンド線（凡例はScatter側で表示） */}
                <Line type="monotone" dataKey="renpho" stroke="#34d399" strokeWidth={2} dot={false} legendType="none" connectNulls isAnimationActive={false} />
                <Line type="monotone" dataKey="elation" stroke="#9ca3af" strokeWidth={2} strokeDasharray="5 4" dot={false} legendType="none" connectNulls isAnimationActive={false} />
                {/* ソース別マーカー（形状・色で区別） */}
                <Scatter dataKey="renpho" name="RENPHO（●実線/緑）" fill="#34d399" shape="circle" />
                <Scatter dataKey="elation" name="Elation（◆点線/灰）" fill="#9ca3af" shape="diamond" />
                <Scatter dataKey="dxa" name="DXA（★/橙）" fill="#fbbf24" shape="star" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="mt-2 text-xs text-gray-600">
          ●RENPHO（緑・実線） / ◆Elation（灰・点線） / ★DXA（橙・スキャン点）。トレンドはRENPHO基準で評価。
        </p>
      </div>

      {/* [19] 体重 ↔ ALT/AST 二軸時系列 */}
      <div className="rounded-xl border border-gray-800 bg-[#161616] p-4">
        <h3 className="mb-1 text-sm font-semibold text-gray-300">
          体重 ↔ 肝機能（ALT/AST）相関
        </h3>
        <p className="mb-3 text-[11px] text-gray-500">
          二軸時系列。完全日付のみ（部分日付の血液は除外）。同一日ペアが無いため散布図ではなく時系列で連動を表示。
        </p>
        {!hasBloodFull || corr.length === 0 ? (
          <EmptyState
            icon="🔬"
            title="相関表示用の血液データが不足しています"
            hint="DB-Bに完全日付（YYYY-MM-DD）のALT/ASTが入ると、体重との連動がここに表示されます。"
          />
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={corr}
                margin={{ top: 5, right: 5, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis dataKey="date" tick={{ fill: "#888", fontSize: 11 }} stroke="#444" />
                <YAxis yAxisId="kg" tick={{ fill: "#888", fontSize: 11 }} stroke="#444" domain={["auto", "auto"]} />
                <YAxis yAxisId="enz" orientation="right" tick={{ fill: "#888", fontSize: 11 }} stroke="#444" domain={["auto", "auto"]} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#aaa" }} />
                <Legend wrapperStyle={{ fontSize: 12, color: "#aaa" }} />
                <ReferenceLine yAxisId="enz" y={58} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "ALT 58", fill: "#ef4444", fontSize: 10, position: "insideTopRight" }} />
                <Line yAxisId="kg" type="monotone" dataKey="weight" name="体重(kg)" stroke="#e5e7eb" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                <Line yAxisId="enz" type="monotone" dataKey="alt" name="ALT" stroke="#fbbf24" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                <Line yAxisId="enz" type="monotone" dataKey="ast" name="AST" stroke="#fb923c" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="mt-2 text-[11px] text-gray-600">
          左軸＝体重kg / 右軸＝ALT・AST。脂肪肝マーカーが減量と連動するかを確認。
        </p>
      </div>

      {/* DXA固定表示 */}
      <div className="rounded-xl border border-gray-800 bg-[#161616] p-4">
        <h3 className="mb-1 text-sm font-semibold text-gray-300">DXAスキャン</h3>
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
