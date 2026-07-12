"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Trade, Position } from "@/lib/types";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function buildPnLChart(trades: Trade[]) {
  const sorted = [...trades].sort(
    (a, b) => new Date(a.executed_at).getTime() - new Date(b.executed_at).getTime()
  );
  let cumPnL = 0;
  const costBasis: Record<string, { totalCost: number; totalShares: number }> = {};
  const data: { date: string; pnl: number }[] = [];

  for (const t of sorted) {
    if (t.action === "buy") {
      if (!costBasis[t.ticker]) costBasis[t.ticker] = { totalCost: 0, totalShares: 0 };
      costBasis[t.ticker].totalCost += Number(t.total_amount);
      costBasis[t.ticker].totalShares += Number(t.shares);
    } else {
      const cb = costBasis[t.ticker];
      if (cb && cb.totalShares > 0) {
        const avgCost = cb.totalCost / cb.totalShares;
        cumPnL += (Number(t.price_per_share) - avgCost) * Number(t.shares);
      }
    }
    const d = new Date(t.executed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    data.push({ date: d, pnl: Math.round(cumPnL * 100) / 100 });
  }
  return data;
}

function fmt(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1000) {
    return (n < 0 ? "-" : "") + "$" + (abs / 1000).toFixed(1) + "K";
  }
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtFull(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function DashboardPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: t }, { data: p }] = await Promise.all([
        supabase.from("trades").select("*").order("executed_at", { ascending: false }),
        supabase.from("positions").select("*"),
      ]);
      setTrades((t as Trade[]) || []);
      setPositions((p as Position[]) || []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-96" style={{ color: '#666' }}>Loading...</div>;
  }

  const totalInvested = positions.reduce((s, p) => s + Number(p.total_invested), 0);
  const totalReturned = positions.reduce((s, p) => s + Number(p.total_returned), 0);
  const netPnL = totalReturned - totalInvested;
  const held = positions.filter((p) => p.status === "held").sort((a, b) => {
    const aVal = Number(a.net_shares) * Number(a.avg_cost_basis);
    const bVal = Number(b.net_shares) * Number(b.avg_cost_basis);
    return bVal - aVal;
  });
  const chartData = buildPnLChart(trades);
  const pnlPositive = netPnL >= 0;
  const pnlColor = pnlPositive ? "#00c805" : "#ff5000";

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Big portfolio number */}
      <div className="text-center py-4">
        <div className="text-4xl font-bold tracking-tight" style={{ color: '#fff' }}>
          {fmtFull(held.reduce((s, p) => s + Number(p.net_shares) * Number(p.avg_cost_basis), 0))}
        </div>
        <div className="text-sm mt-1" style={{ color: pnlColor }}>
          {pnlPositive ? "▲" : "▼"} {fmtFull(Math.abs(netPnL))} ({((netPnL / totalInvested) * 100).toFixed(2)}%)
        </div>
      </div>

      {/* P&L Chart */}
      {chartData.length > 0 && (
        <div className="mt-2 mb-6">
          <div style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={pnlColor} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={pnlColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={false} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ backgroundColor: "#111", border: "1px solid #1a1a1a", borderRadius: 8, color: "#fff", fontSize: 13 }}
                  formatter={(v) => [fmtFull(Number(v)), "P&L"]}
                  labelStyle={{ color: "#666" }}
                />
                <Area type="monotone" dataKey="pnl" stroke={pnlColor} fill="url(#pnlGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="flex gap-3 mb-6">
        {[
          { label: "Invested", value: fmt(totalInvested), color: "#fff" },
          { label: "Returned", value: fmt(totalReturned), color: "#fff" },
          { label: "Net P&L", value: (pnlPositive ? "+" : "") + fmt(netPnL), color: pnlColor },
        ].map((s) => (
          <div key={s.label} className="flex-1 rounded-lg p-4 text-center" style={{ background: "#111" }}>
            <div className="text-[10px] uppercase tracking-widest" style={{ color: "#666" }}>{s.label}</div>
            <div className="text-lg font-semibold mt-1" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Holdings list */}
      <div>
        <div className="text-xs uppercase tracking-widest mb-3" style={{ color: "#666" }}>
          Holdings ({held.length})
        </div>
        <div style={{ borderTop: "1px solid #1a1a1a" }}>
          {held.length === 0 ? (
            <p className="py-8 text-center text-sm" style={{ color: "#666" }}>No open positions</p>
          ) : (
            held.map((p) => {
              const value = Number(p.net_shares) * Number(p.avg_cost_basis);
              // Simulated P&L for display (from position data)
              const unrealizedPnL = Number(p.total_returned) > 0
                ? Number(p.total_returned) - Number(p.total_invested)
                : 0;
              const isGain = unrealizedPnL >= 0;
              return (
                <div
                  key={p.ticker}
                  className="flex items-center justify-between py-3"
                  style={{ borderBottom: "1px solid #111" }}
                >
                  <div>
                    <div className="font-semibold text-[15px]" style={{ color: "#fff" }}>{p.ticker}</div>
                    <div className="text-xs" style={{ color: "#666" }}>
                      {Number(p.net_shares).toFixed(2)} shares
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium" style={{ color: "#fff" }}>
                      {fmtFull(value)}
                    </div>
                    <div
                      className="text-xs font-medium mt-0.5 inline-block px-2 py-0.5 rounded"
                      style={{
                        color: isGain ? "#00c805" : "#ff5000",
                        border: `1px solid ${isGain ? "#00c805" : "#ff5000"}`,
                        borderRadius: 4,
                      }}
                    >
                      {isGain ? "+" : ""}{fmt(unrealizedPnL)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Recent trades */}
      <div className="mt-8">
        <div className="text-xs uppercase tracking-widest mb-3" style={{ color: "#666" }}>
          Recent Trades
        </div>
        <div style={{ borderTop: "1px solid #1a1a1a" }}>
          {trades.slice(0, 8).map((t) => (
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
                  <div className="font-semibold text-sm" style={{ color: "#fff" }}>{t.ticker}</div>
                  <div className="text-xs" style={{ color: "#666" }}>
                    {new Date(t.executed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm" style={{ color: "#fff" }}>
                  {fmtFull(Number(t.total_amount))}
                </div>
                <div className="text-xs" style={{ color: "#666" }}>
                  {Number(t.shares).toFixed(2)} @ ${Number(t.price_per_share).toFixed(2)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
