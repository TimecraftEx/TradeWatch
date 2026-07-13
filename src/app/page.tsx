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

type PriceData = Record<string, { price: number; change: number; changePercent: number }>;

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
  const [prices, setPrices] = useState<PriceData>({});
  const [loading, setLoading] = useState(true);
  const [pricesLoading, setPricesLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: t }, { data: p }] = await Promise.all([
        supabase.from("trades").select("*").order("executed_at", { ascending: false }),
        supabase.from("positions").select("*"),
      ]);
      setTrades((t as Trade[]) || []);
      const pos = (p as Position[]) || [];
      setPositions(pos);
      setLoading(false);

      // Fetch live prices for held positions
      const heldTickers = pos
        .filter((p) => p.status === "held" && Number(p.net_shares) > 0.01)
        .map((p) => p.ticker);

      if (heldTickers.length > 0) {
        try {
          const res = await fetch(`/api/prices?tickers=${heldTickers.join(",")}`);
          const data = await res.json();
          setPrices(data);
        } catch {
          // Prices unavailable
        }
      }
      setPricesLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-96" style={{ color: "#666" }}>Loading...</div>;
  }

  const held = positions
    .filter((p) => p.status === "held" && Number(p.net_shares) > 0.01)
    .sort((a, b) => {
      const aPrice = prices[a.ticker]?.price || Number(a.avg_cost_basis);
      const bPrice = prices[b.ticker]?.price || Number(b.avg_cost_basis);
      return (Number(b.net_shares) * bPrice) - (Number(a.net_shares) * aPrice);
    });

  // Calculate portfolio value using live prices
  const portfolioValue = held.reduce((sum, p) => {
    const livePrice = prices[p.ticker]?.price;
    const price = livePrice || Number(p.avg_cost_basis);
    return sum + Number(p.net_shares) * price;
  }, 0);

  const totalCostBasis = held.reduce((sum, p) => sum + Number(p.net_shares) * Number(p.avg_cost_basis), 0);
  const totalUnrealizedPnL = portfolioValue - totalCostBasis;
  const totalDayChange = held.reduce((sum, p) => {
    const change = prices[p.ticker]?.change || 0;
    return sum + Number(p.net_shares) * change;
  }, 0);

  const hasPrices = Object.keys(prices).length > 0;
  const pnlPositive = totalUnrealizedPnL >= 0;
  const dayPositive = totalDayChange >= 0;
  const pnlColor = pnlPositive ? "#00c805" : "#ff5000";
  const dayColor = dayPositive ? "#00c805" : "#ff5000";

  const totalInvested = positions.reduce((s, p) => s + Number(p.total_invested), 0);
  const totalReturned = positions.reduce((s, p) => s + Number(p.total_returned), 0);
  const realizedPnL = totalReturned - totalInvested;
  const chartData = buildPnLChart(trades);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Big portfolio number */}
      <div className="text-center py-4">
        <div className="text-4xl font-bold tracking-tight" style={{ color: "#fff" }}>
          {hasPrices ? fmtFull(portfolioValue) : pricesLoading ? "Loading..." : fmtFull(totalCostBasis)}
        </div>
        {hasPrices ? (
          <div className="mt-1">
            <span className="text-sm" style={{ color: dayColor }}>
              {dayPositive ? "▲" : "▼"} {fmtFull(Math.abs(totalDayChange))} ({Math.abs((totalDayChange / (portfolioValue - totalDayChange)) * 100).toFixed(2)}%) Today
            </span>
          </div>
        ) : pricesLoading ? (
          <div className="text-sm mt-1" style={{ color: "#666" }}>Fetching live prices...</div>
        ) : null}
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
          { label: "Portfolio", value: hasPrices ? fmtFull(portfolioValue) : "—", color: "#fff" },
          { label: "Day Change", value: hasPrices ? (dayPositive ? "+" : "") + fmtFull(totalDayChange) : "—", color: hasPrices ? dayColor : "#666" },
          { label: "Unrealized", value: hasPrices ? (pnlPositive ? "+" : "") + fmt(totalUnrealizedPnL) : "—", color: hasPrices ? pnlColor : "#666" },
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
              const shares = Number(p.net_shares);
              const avgCost = Number(p.avg_cost_basis);
              const livePrice = prices[p.ticker]?.price;
              const currentPrice = livePrice || avgCost;
              const marketValue = shares * currentPrice;
              const costValue = shares * avgCost;
              const unrealized = marketValue - costValue;
              const isGain = unrealized >= 0;
              const dayChange = prices[p.ticker]?.change;
              const dayPnL = dayChange ? shares * dayChange : null;

              return (
                <div
                  key={p.ticker}
                  className="flex items-center justify-between py-3"
                  style={{ borderBottom: "1px solid #111" }}
                >
                  <div>
                    <div className="font-semibold text-[15px]" style={{ color: "#fff" }}>{p.ticker}</div>
                    <div className="text-xs" style={{ color: "#666" }}>
                      {shares.toFixed(2)} shares
                      {livePrice && <span> · ${livePrice.toFixed(2)}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium" style={{ color: "#fff" }}>
                      {fmtFull(marketValue)}
                    </div>
                    <div className="flex items-center gap-2 justify-end mt-0.5">
                      {dayPnL !== null && (
                        <span className="text-[11px]" style={{ color: dayPnL >= 0 ? "#00c805" : "#ff5000" }}>
                          {dayPnL >= 0 ? "+" : ""}{fmtFull(dayPnL)}
                        </span>
                      )}
                      <span
                        className="text-[11px] font-medium px-1.5 py-0.5 rounded"
                        style={{
                          color: isGain ? "#00c805" : "#ff5000",
                          border: `1px solid ${isGain ? "#00c805" : "#ff5000"}`,
                        }}
                      >
                        {isGain ? "+" : ""}{fmt(unrealized)}
                      </span>
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
