"use client";

import { DATA_GAPS } from "@/lib/constants";

/**
 * データ欠損の注記（表示層のみ・Notionは変更しない）。
 * 欠損日を「未使用日」と区別してグレー表示で明示する。
 */
export default function DataGapNote() {
  if (DATA_GAPS.length === 0) return null;
  return (
    <div className="rounded-lg border border-gray-700/60 bg-[#161616] px-3 py-2 text-xs text-gray-500">
      {DATA_GAPS.map((g, i) => (
        <div key={i} className="flex items-start gap-1.5">
          <span aria-hidden className="text-gray-600">
            ⚪
          </span>
          <span>
            <span className="text-gray-400">{g.dates.join("・")}</span>：
            {g.label}
            <span className="mt-0.5 block text-gray-600">{g.detail}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
