"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Trade, Position, LastTrade } from "@/lib/types";
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
  if (abs >= 1000) return (n < 0 ? "-" : "") + "$" + (abs / 1000).toFixed(1) + "K";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtFull(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Shared stock row component
function StockRow({ p, prices, lastTrades, isClosed }: {
  p: Position;
  prices: PriceData;
  lastTrades: Record<string, LastTrade>;
  isClosed: boolean;
}) {
  const shares = Number(p.net_shares);
  const avgCost = Number(p.avg_cost_basis);
  const livePrice = prices[p.ticker]?.price;
  const currentPrice = livePrice || avgCost;

  const lt = lastTrades[p.ticker];
  const lastBuyPrice = lt?.last_buy_price;
  const lastSellPrice = lt?.last_sell_price;
  const pctFromBuy = lastBuyPrice && livePrice
    ? ((livePrice - lastBuyPrice) / lastBuyPrice) * 100
    : null;
  const pctFromSell = lastSellPrice && livePrice
    ? ((livePrice - lastSellPrice) / lastSellPrice) * 100
    : null;

  if (isClosed) {
    // Closed position: show ticker, last sell price/date, current price, % change from sell
    return (
      <div
        className="py-3 px-3 rounded-lg mb-1"
        style={{ background: "#0d1117", borderLeft: "2px solid #1e2a3a" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-[15px]" style={{ color: "#8b949e" }}>{p.ticker}</div>
            <div className="text-xs" style={{ color: "#484f58" }}>
              Closed · Avg cost ${avgCost.toFixed(2)}
            </div>
          </div>
          <div className="text-right">
            {livePrice && (
              <div className="text-sm font-medium" style={{ color: "#8b949e" }}>
                ${livePrice.toFixed(2)}
              </div>
            )}
            {pctFromSell !== null && (
              <span
                className="text-[11px] font-medium px-1.5 py-0.5 rounded"
                style={{
                  color: pctFromSell >= 0 ? "#00c805" : "#ff5000",
                  background: pctFromSell >= 0 ? "rgba(0,200,5,0.08)" : "rgba(255,80,0,0.08)",
                }}
              >
                {pctFromSell >= 0 ? "+" : ""}{pctFromSell.toFixed(1)}% since sell
              </span>
            )}
          </div>
        </div>
        {lt && (
          <div className="flex items-center gap-4 mt-1.5">
            {lastBuyPrice !== null && (
              <span className="text-[11px]" style={{ color: "#484f58" }}>
                <span style={{ color: "#238636" }}>B</span>{" "}
                ${lastBuyPrice.toFixed(2)}
                {lt.last_buy_date && <span> · {fmtDate(lt.last_buy_date)}</span>}
              </span>
            )}
            {lastSellPrice !== null && (
              <span className="text-[11px]" style={{ color: "#484f58" }}>
                <span style={{ color: "#da3633" }}>S</span>{" "}
                ${lastSellPrice.toFixed(2)}
                {lt.last_sell_date && <span> · {fmtDate(lt.last_sell_date)}</span>}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  // Held position
  const marketValue = shares * currentPrice;
  const costValue = shares * avgCost;
  const unrealized = marketValue - costValue;
  const isGain = unrealized >= 0;
  const dayChange = prices[p.ticker]?.change;
  const dayPnL = dayChange ? shares * dayChange : null;

  return (
    <div className="py-3" style={{ borderBottom: "1px solid #111" }}>
      <div className="flex items-center justify-between">
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
      {lt && (
        <div className="flex items-center gap-4 mt-1.5">
          {lastBuyPrice !== null && (
            <span className="text-[11px]" style={{ color: "#666" }}>
              <span style={{ color: "#00c805" }}>B</span>{" "}
              ${lastBuyPrice.toFixed(2)}
              {lt.last_buy_date && <span> · {fmtDate(lt.last_buy_date)}</span>}
            </span>
          )}
          {lastSellPrice !== null && (
            <span className="text-[11px]" style={{ color: "#666" }}>
              <span style={{ color: "#ff5000" }}>S</span>{" "}
              ${lastSellPrice.toFixed(2)}
              {lt.last_sell_date && <span> · {fmtDate(lt.last_sell_date)}</span>}
            </span>
          )}
          {pctFromBuy !== null && (
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded"
              style={{
                color: pctFromBuy >= 0 ? "#00c805" : "#ff5000",
                background: pctFromBuy >= 0 ? "rgba(0,200,5,0.1)" : "rgba(255,80,0,0.1)",
              }}
            >
              {pctFromBuy >= 0 ? "+" : ""}{pctFromBuy.toFixed(1)}% from buy
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [prices, setPrices] = useState<PriceData>({});
  const [lastTrades, setLastTrades] = useState<Record<string, LastTrade>>({});
  const [loading, setLoading] = useState(true);
  const [pricesLoading, setPricesLoading] = useState(true);
  const [showClosed, setShowClosed] = useState(false);

  useEffect(() => {
    async function load() {
      const [{ data: t }, { data: p }] = await Promise.all([
        supabase.from("trades").select("*").order("executed_at", { ascending: false }),
        supabase.from("positions").select("*"),
      ]);
      setTrades((t as Trade[]) || []);
      const pos = (p as Position[]) || [];
      setPositions(pos);

      // Get last buy/sell per ALL tickers (held + closed)
      const allTickers = pos.map((p) => p.ticker);
      if (allTickers.length > 0 && t) {
        const lastTradeMap: Record<string, LastTrade> = {};
        for (const ticker of allTickers) {
          const tickerTrades = (t as Trade[]).filter((tr) => tr.ticker === ticker);
          const lastBuy = tickerTrades.find((tr) => tr.action === "buy");
          const lastSell = tickerTrades.find((tr) => tr.action === "sell");
          lastTradeMap[ticker] = {
            ticker,
            last_buy_price: lastBuy ? Number(lastBuy.price_per_share) : null,
            last_buy_date: lastBuy ? lastBuy.executed_at : null,
            last_sell_price: lastSell ? Number(lastSell.price_per_share) : null,
            last_sell_date: lastSell ? lastSell.executed_at : null,
          };
        }
        setLastTrades(lastTradeMap);
      }

      setLoading(false);

      // Fetch live prices for held tickers first
      const heldTickers = pos
        .filter((p) => p.status === "held" && Number(p.net_shares) > 0.01)
        .map((p) => p.ticker);

      if (heldTickers.length > 0) {
        try {
          const res = await fetch(`/api/prices?tickers=${heldTickers.join(",")}`);
          const data = await res.json();
          setPrices(data);
        } catch { /* */ }
      }
      setPricesLoading(false);
    }
    load();
  }, []);

  // Fetch closed position prices when section is opened
  useEffect(() => {
    if (!showClosed) return;
    const closedTickers = positions
      .filter((p) => p.status === "closed" && !prices[p.ticker])
      .map((p) => p.ticker)
      .filter((t) => t && t.length <= 5 && /^[A-Z]+$/.test(t));

    if (closedTickers.length === 0) return;

    // Fetch in batches of 10 to avoid overloading
    const batch = closedTickers.slice(0, 10);
    fetch(`/api/prices?tickers=${batch.join(",")}`)
      .then((r) => r.json())
      .then((data) => setPrices((prev) => ({ ...prev, ...data })))
      .catch(() => {});
  }, [showClosed, positions, prices]);

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

  const closed = positions
    .filter((p) => p.status === "closed" && Number(p.total_invested) > 0)
    .sort((a, b) => {
      // Sort by last sell date (most recent first)
      const aDate = lastTrades[a.ticker]?.last_sell_date || "1970";
      const bDate = lastTrades[b.ticker]?.last_sell_date || "1970";
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });

  const portfolioValue = held.reduce((sum, p) => {
    const price = prices[p.ticker]?.price || Number(p.avg_cost_basis);
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

      {/* Current Holdings */}
      <div>
        <div className="text-xs uppercase tracking-widest mb-3" style={{ color: "#666" }}>
          Holdings ({held.length})
        </div>
        <div style={{ borderTop: "1px solid #1a1a1a" }}>
          {held.length === 0 ? (
            <p className="py-8 text-center text-sm" style={{ color: "#666" }}>No open positions</p>
          ) : (
            held.map((p) => (
              <StockRow key={p.ticker} p={p} prices={prices} lastTrades={lastTrades} isClosed={false} />
            ))
          )}
        </div>
      </div>

      {/* Previously Owned */}
      <div className="mt-8">
        <button
          onClick={() => setShowClosed(!showClosed)}
          className="flex items-center gap-2 text-xs uppercase tracking-widest mb-3"
          style={{ color: "#666" }}
        >
          <span style={{ color: showClosed ? "#00c805" : "#444", transition: "transform 0.2s", display: "inline-block", transform: showClosed ? "rotate(90deg)" : "rotate(0deg)" }}>
            ▶
          </span>
          Previously Owned ({closed.length})
        </button>
        {showClosed && (
          <div className="space-y-1">
            {closed.map((p) => (
              <StockRow key={p.ticker} p={p} prices={prices} lastTrades={lastTrades} isClosed={true} />
            ))}
          </div>
        )}
      </div>

      {/* Recent trades */}
      <div className="mt-8">
        <div className="text-xs uppercase tracking-widest mb-3" style={{ color: "#666" }}>
          Recent Trades
        </div>
        <div style={{ borderTop: "1px solid #1a1a1a" }}>
          {trades.slice(0, 8).map((t) => {
            const livePrice = prices[t.ticker]?.price;
            const lastSell = trades.find((tr) => tr.ticker === t.ticker && tr.action === "sell");
            return (
              <div key={t.id} className="py-3" style={{ borderBottom: "1px solid #111" }}>
                <div className="flex items-center justify-between">
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
                <div className="flex items-center gap-4 mt-1 ml-11">
                  {livePrice && (
                    <span className="text-[11px]" style={{ color: "#888" }}>
                      Now <span style={{ color: "#fff" }}>${livePrice.toFixed(2)}</span>
                    </span>
                  )}
                  {lastSell && (
                    <span className="text-[11px]" style={{ color: "#888" }}>
                      Last sold <span style={{ color: "#ff5000" }}>${Number(lastSell.price_per_share).toFixed(2)}</span>
                      <span> · {fmtDate(lastSell.executed_at)}</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
