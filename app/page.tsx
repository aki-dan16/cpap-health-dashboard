"use client";

import { useEffect, useState } from "react";
import TabNav from "./components/TabNav";
import SummaryTab from "./components/SummaryTab";
import TrendTab from "./components/TrendTab";
import HistoryTab from "./components/HistoryTab";
import BloodTab from "./components/BloodTab";
import WeightTab from "./components/WeightTab";
import MedTab from "./components/MedTab";
import ErrorBoundary from "./components/ErrorBoundary";
import type { ApiResponse, CpapRow, BloodRow, WeightRow } from "@/lib/types";
import {
  type LocationTz,
  LOCATION_OPTIONS,
  LOC_STORAGE_KEY,
  formatUpdatedMultiTz,
} from "@/lib/tz";

async function fetchRows<T>(url: string): Promise<{ rows: T[]; error?: string }> {
  const res = await fetch(url, { cache: "no-store" });
  const data = (await res.json()) as ApiResponse<T>;
  return { rows: data.rows ?? [], error: data.error };
}

export default function Home() {
  const [active, setActive] = useState("summary");
  const [cpap, setCpap] = useState<CpapRow[]>([]);
  const [blood, setBlood] = useState<BloodRow[]>([]);
  const [weight, setWeight] = useState<WeightRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  // 現在地TZ（localStorage保持）— TZ-4
  const [locTz, setLocTz] = useState<LocationTz>("HST");

  useEffect(() => {
    const saved = window.localStorage.getItem(LOC_STORAGE_KEY);
    if (saved === "HST" || saved === "PST" || saved === "JST") setLocTz(saved);
  }, []);

  const changeLocTz = (v: LocationTz) => {
    setLocTz(v);
    window.localStorage.setItem(LOC_STORAGE_KEY, v);
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const [c, b, w] = await Promise.all([
        fetchRows<CpapRow>("/api/cpap"),
        fetchRows<BloodRow>("/api/blood"),
        fetchRows<WeightRow>("/api/weight"),
      ]);
      if (!mounted) return;
      setCpap(c.rows);
      setBlood(b.rows);
      setWeight(w.rows);
      const errs = [c.error, b.error, w.error].filter(Boolean) as string[];
      setErrors(errs);
      setUpdatedAt(new Date());
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-5">
      <header className="mb-2 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-100 sm:text-2xl">
            🫁 CPAP Health Dashboard
          </h1>
          <p className="text-xs text-gray-500">
            CPAP・血液検査・体重の統合モニタリング
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-1 text-xs text-gray-400">
          <span className="hidden sm:inline">現在地TZ</span>
          <span aria-hidden>🌐</span>
          <select
            value={locTz}
            onChange={(e) => changeLocTz(e.target.value as LocationTz)}
            className="rounded-md border border-gray-700 bg-[#161616] px-2 py-1 text-gray-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            {LOCATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </header>

      <TabNav active={active} onChange={setActive} />

      {errors.length > 0 && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          <p className="font-semibold">⚠️ データ取得エラー</p>
          <ul className="mt-1 list-inside list-disc">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-red-400/80">
            .env.local の NOTION_TOKEN とDB ID、Notionインテグレーションの共有設定をご確認ください。
          </p>
        </div>
      )}

      <main className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-500">
            <span className="animate-pulse">データを読み込み中…</span>
          </div>
        ) : (
          <ErrorBoundary label={active} key={active}>
            {active === "summary" && <SummaryTab cpap={cpap} />}
            {active === "trend" && <TrendTab cpap={cpap} />}
            {active === "history" && <HistoryTab cpap={cpap} />}
            {active === "blood" && <BloodTab blood={blood} />}
            {active === "weight" && <WeightTab weight={weight} />}
            {active === "med" && <MedTab />}
          </ErrorBoundary>
        )}
      </main>

      <footer className="mt-8 border-t border-gray-800 pt-4 text-xs text-gray-500">
        <p className="text-right">
          最終更新：
          {updatedAt ? formatUpdatedMultiTz(updatedAt, locTz) : "—"}
        </p>
        <p className="mt-2 text-gray-600">
          データの評価は参考値です。医学的判断は主治医（相馬先生）に委ねてください。
        </p>
      </footer>
    </div>
  );
}
