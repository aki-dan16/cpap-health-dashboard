"use client";

import { useEffect, useState } from "react";
import type { NextInjection } from "@/lib/types";
import {
  LEVEL_TEXT,
  LEVEL_BADGE,
  LEVEL_DOT,
  levelInjectionDays,
} from "@/lib/health";

/** "YYYY-MM-DD" を「M/D」の短い表記にする（コンパクト表示用）。 */
function md(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${m}/${d}`;
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
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-lg border border-gray-800 bg-[#161616]"
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
      {/* コンパクトな2列カード（モバイルでは縦積み） */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {rows.map((inj) => {
          const level = levelInjectionDays(inj.daysUntil);
          return (
            <div key={inj.drug} className={`rounded-lg border px-3 py-2 ${LEVEL_BADGE[level]}`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-base font-semibold text-gray-100">
                  {inj.drug}
                  {inj.dose && (
                    <span className="ml-1 text-xs font-normal text-gray-400">
                      {inj.dose}
                    </span>
                  )}
                </span>
                <span className={`text-xs font-semibold ${LEVEL_TEXT[level]}`}>
                  {LEVEL_DOT[level]} {daysLabel(inj.daysUntil)}
                </span>
              </div>
              <div className="mt-0.5 text-base text-gray-100">
                次回 {md(inj.nextDate)}
                <span className="ml-1 text-sm text-gray-400">
                  （最終 {md(inj.lastDate)}）
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
