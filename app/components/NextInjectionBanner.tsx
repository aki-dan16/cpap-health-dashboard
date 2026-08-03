"use client";

import { useEffect, useState } from "react";
import type { NextInjection } from "@/lib/types";
import {
  LEVEL_TEXT,
  LEVEL_BADGE,
  LEVEL_DOT,
  levelInjectionDays,
} from "@/lib/health";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

/** "YYYY-MM-DD" を「M/D (曜)」の日本語表記にする（曜日はUTC基準で安定に算出）。 */
function formatMd(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const wd = new Date(Date.UTC(y || 1970, (m || 1) - 1, d || 1)).getUTCDay();
  return `${m}/${d} (${WEEKDAYS[wd]})`;
}

/** 残日数の文言。0=今日 / 1=明日 / 2以上=あとN日 / 負数=N日超過。 */
function daysLabel(n: number): string {
  if (n === 0) return "今日";
  if (n === 1) return "明日";
  if (n >= 2) return `あと ${n} 日`;
  return `${Math.abs(n)} 日超過`;
}

export default function NextInjectionBanner() {
  const [rows, setRows] = useState<NextInjection[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/injections", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { rows?: NextInjection[]; error?: string }) => {
        if (!alive) return;
        if (data?.error) {
          setFailed(true);
          return;
        }
        setRows(Array.isArray(data?.rows) ? data.rows : []);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  // 取得失敗時はコンポーネント自体を非表示（他の部分に影響を与えない）
  if (failed) return null;

  // データ取得中：スケルトン
  if (rows === null) {
    return (
      <section className="mb-4">
        <h2 className="mb-2 text-sm font-semibold text-gray-300">💉 次回注射</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl border border-gray-800 bg-[#161616]"
            />
          ))}
        </div>
      </section>
    );
  }

  // 対象データが無ければ非表示
  if (rows.length === 0) return null;

  return (
    <section className="mb-4">
      <h2 className="mb-2 text-sm font-semibold text-gray-300">💉 次回注射</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {rows.map((inj) => {
          const level = levelInjectionDays(inj.daysUntil);
          return (
            <div key={inj.drug} className={`rounded-xl border p-4 ${LEVEL_BADGE[level]}`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-bold text-gray-100">{inj.drug}</span>
                {inj.dose && (
                  <span className="text-sm text-gray-400">{inj.dose}</span>
                )}
              </div>
              <div className="mt-1 text-lg font-semibold text-gray-100">
                {formatMd(inj.nextDate)}
              </div>
              <div className={`mt-0.5 text-sm ${LEVEL_TEXT[level]}`}>
                {LEVEL_DOT[level]} {daysLabel(inj.daysUntil)}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
