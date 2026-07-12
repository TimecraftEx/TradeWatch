"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Trade } from "@/lib/types";

export default function TradesPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "buy" | "sell">("all");

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("trades")
        .select("*")
        .order("executed_at", { ascending: false });
      setTrades((data as Trade[]) || []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = trades.filter((t) => {
    if (filter !== "all" && t.action !== filter) return false;
    if (search && !t.ticker.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return <div className="flex items-center justify-center h-96" style={{ color: "#666" }}>Loading...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Trade History</h1>
        <span className="text-sm" style={{ color: "#666" }}>{trades.length} trades</span>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <input
          placeholder="Search ticker..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm max-w-[200px] outline-none"
          style={{ background: "#111", border: "1px solid #1a1a1a", color: "#fff" }}
        />
        <div className="flex gap-2">
          {(["all", "buy", "sell"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
              style={{
                background: filter === f ? "#1a1a1a" : "transparent",
                color: filter === f ? "#fff" : "#666",
                border: filter === f ? "1px solid #333" : "1px solid transparent",
              }}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Trade list */}
      <div style={{ borderTop: "1px solid #1a1a1a" }}>
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm" style={{ color: "#666" }}>
            {trades.length === 0 ? "No trades imported yet." : "No trades match your filter."}
          </p>
        ) : (
          filtered.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between py-3"
              style={{ borderBottom: "1px solid #111" }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="text-[10px] font-bold uppercase w-8 text-center py-0.5 rounded"
                  style={{
                    color: t.action === "buy" ? "#00c805" : "#ff5000",
                    border: `1px solid ${t.action === "buy" ? "#00c805" : "#ff5000"}`,
                  }}
                >
                  {t.action === "buy" ? "B" : "S"}
                </span>
                <div>
                  <div className="font-semibold text-sm">{t.ticker}</div>
                  <div className="text-xs" style={{ color: "#666" }}>
                    {new Date(t.executed_at).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium">
                  ${Number(t.total_amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </div>
                <div className="text-xs" style={{ color: "#666" }}>
                  {Number(t.shares).toFixed(4)} @ ${Number(t.price_per_share).toFixed(2)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
