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

type PriceData = Record<string, { price: number; change: number; changePercent: number; analystRating?: string | null; priceTarget?: number | null; newsUrl?: string | null }>;
type TabView = "holdings" | "previously" | "recent";
type SortMode = "value" | "gainer" | "loser";

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

const RATING_COLORS: Record<string, string> = {
  "Strong Buy": "#00c805",
  "Buy": "#00c805",
  "Moderate Buy": "#7dd87d",
  "Overweight": "#7dd87d",
  "Hold": "#f59e0b",
  "Sell": "#ff5000",
  "Strong Sell": "#ff5000",
  "Underweight": "#ff5000",
};

// Shared stock row component — thick card block style
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
  const priceData = prices[p.ticker];

  const lt = lastTrades[p.ticker];
  const lastBuyPrice = lt?.last_buy_price;
  const lastSellPrice = lt?.last_sell_price;
  const pctFromBuy = lastBuyPrice && livePrice
    ? ((livePrice - lastBuyPrice) / lastBuyPrice) * 100
    : null;
  const pctFromSell = lastSellPrice && livePrice
    ? ((livePrice - lastSellPrice) / lastSellPrice) * 100
    : null;

  const cardBg = isClosed ? "#0a0e14" : "#111";
  const borderColor = isClosed ? "#1e2a3a" : "#222";
  const textColor = isClosed ? "#8b949e" : "#fff";
  const subColor = isClosed ? "#484f58" : "#888";
  const greenColor = "#00c805";
  const redColor = "#ff5000";

  const marketValue = isClosed ? 0 : shares * currentPrice;
  const costValue = isClosed ? 0 : shares * avgCost;
  const unrealized = marketValue - costValue;
  const isGain = unrealized >= 0;
  const dayChange = prices[p.ticker]?.change;
  const dayPnL = !isClosed && dayChange ? shares * dayChange : null;

  return (
    <div
      className="rounded-xl p-3 sm:p-4 mb-2"
      style={{ background: cardBg, border: `1px solid ${borderColor}` }}
    >
      {/* Top row: ticker + value */}
      <div className="flex items-start justify-between mb-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
            <span className="font-bold text-base sm:text-lg" style={{ color: textColor }}>{p.ticker}</span>
            {priceData?.analystRating && (
              <span
                className="text-[8px] sm:text-[10px] font-bold uppercase px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full"
                style={{
                  color: RATING_COLORS[priceData.analystRating] || "#f59e0b",
                  background: `${RATING_COLORS[priceData.analystRating] || "#f59e0b"}15`,
                  border: `1px solid ${RATING_COLORS[priceData.analystRating] || "#f59e0b"}40`,
                }}
              >
                {priceData.analystRating}
              </span>
            )}
            {priceData?.newsUrl && (
              <a
                href={priceData.newsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[8px] sm:text-[10px] font-bold uppercase px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full"
                style={{ color: "#58a6ff", background: "#58a6ff15", border: "1px solid #58a6ff40" }}
              >
                News
              </a>
            )}
          </div>
          <div className="text-[11px] sm:text-xs" style={{ color: subColor }}>
            {isClosed ? `Closed · Avg $${avgCost.toFixed(2)}` : `${shares.toFixed(2)} shares`}
            {livePrice && <span> · <strong style={{ color: textColor }}>${livePrice.toFixed(2)}</strong></span>}
            {priceData?.priceTarget && (
              <span> · Target <strong style={{ color: "#f59e0b" }}>${priceData.priceTarget.toFixed(0)}</strong></span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0 ml-2">
          {!isClosed && (
            <div className="text-sm sm:text-base font-bold" style={{ color: textColor }}>
              {fmtFull(marketValue)}
            </div>
          )}
          <div className="flex items-center gap-1.5 sm:gap-2 justify-end mt-0.5">
            {dayPnL !== null && (
              <span className="text-[10px] sm:text-xs font-semibold" style={{ color: dayPnL >= 0 ? greenColor : redColor }}>
                {dayPnL >= 0 ? "+" : ""}{fmtFull(dayPnL)}
              </span>
            )}
            {!isClosed && (
              <span
                className="text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full"
                style={{
                  color: isGain ? greenColor : redColor,
                  background: isGain ? "rgba(0,200,5,0.12)" : "rgba(255,80,0,0.12)",
                  border: `1px solid ${isGain ? greenColor : redColor}50`,
                }}
              >
                {isGain ? "+" : ""}{fmt(unrealized)}
              </span>
            )}
            {isClosed && pctFromSell !== null && (
              <span
                className="text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full"
                style={{
                  color: pctFromSell >= 0 ? greenColor : redColor,
                  background: pctFromSell >= 0 ? "rgba(0,200,5,0.12)" : "rgba(255,80,0,0.12)",
                }}
              >
                {pctFromSell >= 0 ? "+" : ""}{pctFromSell.toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Buy/Sell price buttons — bold pill style, wrap on mobile */}
      {lt && (
        <div className="flex items-center gap-1.5 sm:gap-2 mt-2 flex-wrap">
          {lastBuyPrice !== null && (
            <div
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold"
              style={{ background: "rgba(0,200,5,0.12)", border: "1px solid rgba(0,200,5,0.3)" }}
            >
              <span style={{ color: greenColor }}>BUY</span>
              <span style={{ color: "#fff" }}>${lastBuyPrice.toFixed(2)}</span>
              {lt.last_buy_date && <span style={{ color: subColor }}>· {fmtDate(lt.last_buy_date)}</span>}
            </div>
          )}
          {lastSellPrice !== null && (
            <div
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold"
              style={{ background: "rgba(255,80,0,0.12)", border: "1px solid rgba(255,80,0,0.3)" }}
            >
              <span style={{ color: redColor }}>SELL</span>
              <span style={{ color: "#fff" }}>${lastSellPrice.toFixed(2)}</span>
              {lt.last_sell_date && <span style={{ color: subColor }}>· {fmtDate(lt.last_sell_date)}</span>}
            </div>
          )}
          {!isClosed && pctFromBuy !== null && (
            <span
              className="text-[9px] sm:text-[11px] font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full"
              style={{
                color: pctFromBuy >= 0 ? greenColor : redColor,
                background: pctFromBuy >= 0 ? "rgba(0,200,5,0.08)" : "rgba(255,80,0,0.08)",
              }}
            >
              {pctFromBuy >= 0 ? "+" : ""}{pctFromBuy.toFixed(1)}%
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
  const [activeTab, setActiveTab] = useState<TabView>("holdings");
  const [sortMode, setSortMode] = useState<SortMode>("value");

  useEffect(() => {
    async function load() {
      const [{ data: t }, { data: p }] = await Promise.all([
        supabase.from("trades").select("*").order("executed_at", { ascending: false }),
        supabase.from("positions").select("*"),
      ]);
      setTrades((t as Trade[]) || []);
      const pos = (p as Position[]) || [];
      setPositions(pos);

      // Get last buy/sell per ALL tickers
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

      // Fetch live prices for held tickers
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

  // Fetch closed position prices when tab is selected
  useEffect(() => {
    if (activeTab !== "previously") return;
    const closedTickers = positions
      .filter((p) => p.status === "closed" && !prices[p.ticker])
      .map((p) => p.ticker)
      .filter((t) => t && t.length <= 5 && /^[A-Z]+$/.test(t));
    if (closedTickers.length === 0) return;
    const batch = closedTickers.slice(0, 10);
    fetch(`/api/prices?tickers=${batch.join(",")}`)
      .then((r) => r.json())
      .then((data) => setPrices((prev) => ({ ...prev, ...data })))
      .catch(() => {});
  }, [activeTab, positions, prices]);

  if (loading) {
    return <div className="flex items-center justify-center h-96" style={{ color: "#666" }}>Loading...</div>;
  }

  // Sort helper for held positions
  const held = positions
    .filter((p) => p.status === "held" && Number(p.net_shares) > 0.01)
    .sort((a, b) => {
      const aPrice = prices[a.ticker]?.price || Number(a.avg_cost_basis);
      const bPrice = prices[b.ticker]?.price || Number(b.avg_cost_basis);
      const aShares = Number(a.net_shares);
      const bShares = Number(b.net_shares);

      if (sortMode === "gainer") {
        const aPct = prices[a.ticker]?.changePercent || 0;
        const bPct = prices[b.ticker]?.changePercent || 0;
        return bPct - aPct; // biggest gainer first
      }
      if (sortMode === "loser") {
        const aPct = prices[a.ticker]?.changePercent || 0;
        const bPct = prices[b.ticker]?.changePercent || 0;
        return aPct - bPct; // biggest loser first
      }
      return (bShares * bPrice) - (aShares * aPrice); // by value
    });

  const closed = positions
    .filter((p) => p.status === "closed" && Number(p.total_invested) > 0)
    .sort((a, b) => {
      if (sortMode === "gainer") {
        const aPct = prices[a.ticker]?.changePercent || 0;
        const bPct = prices[b.ticker]?.changePercent || 0;
        return bPct - aPct;
      }
      if (sortMode === "loser") {
        const aPct = prices[a.ticker]?.changePercent || 0;
        const bPct = prices[b.ticker]?.changePercent || 0;
        return aPct - bPct;
      }
      // Default: most recent sell first
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
    <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
      {/* Big portfolio number */}
      <div className="text-center py-3 sm:py-4">
        <div className="text-2xl sm:text-4xl font-bold tracking-tight" style={{ color: "#fff" }}>
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
      <div className="flex gap-2 sm:gap-3 mb-4 sm:mb-6">
        {[
          { label: "Portfolio", value: hasPrices ? fmtFull(portfolioValue) : "—", color: "#fff" },
          { label: "Day", value: hasPrices ? (dayPositive ? "+" : "") + fmt(totalDayChange) : "—", color: hasPrices ? dayColor : "#666" },
          { label: "Unrealized", value: hasPrices ? (pnlPositive ? "+" : "") + fmt(totalUnrealizedPnL) : "—", color: hasPrices ? pnlColor : "#666" },
        ].map((s) => (
          <div key={s.label} className="flex-1 rounded-lg p-2.5 sm:p-4 text-center" style={{ background: "#111" }}>
            <div className="text-[8px] sm:text-[10px] uppercase tracking-widest" style={{ color: "#666" }}>{s.label}</div>
            <div className="text-sm sm:text-lg font-semibold mt-0.5 sm:mt-1" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs: Holdings | Previously Owned | Recent Trades */}
      <div className="flex items-center gap-1 mb-3 sm:mb-4 p-1 rounded-lg overflow-x-auto" style={{ background: "#111" }}>
        {([
          { key: "holdings" as TabView, label: `Holdings (${held.length})` },
          { key: "previously" as TabView, label: `Past (${closed.length})` },
          { key: "recent" as TabView, label: "Recent" },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="flex-1 py-1.5 sm:py-2 text-[10px] sm:text-xs font-medium rounded-md transition-colors whitespace-nowrap"
            style={{
              background: activeTab === tab.key ? "#000" : "transparent",
              color: activeTab === tab.key ? "#fff" : "#666",
              border: activeTab === tab.key ? "1px solid #333" : "1px solid transparent",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sort controls (for holdings and previously owned) */}
      {activeTab !== "recent" && (
        <div className="flex items-center gap-1 sm:gap-2 mb-3 sm:mb-4 p-1 rounded-lg" style={{ background: "#0a0a0a" }}>
          {([
            { key: "value" as SortMode, label: "Value", mobileLabel: "$", icon: "$ " },
            { key: "gainer" as SortMode, label: "Gainers", mobileLabel: "▲", icon: "▲ " },
            { key: "loser" as SortMode, label: "Losers", mobileLabel: "▼", icon: "▼ " },
          ]).map((s) => (
            <button
              key={s.key}
              onClick={() => setSortMode(s.key)}
              className="flex-1 text-[10px] sm:text-xs font-semibold py-1.5 sm:py-2 rounded-md transition-all"
              style={{
                background: sortMode === s.key
                  ? s.key === "gainer" ? "rgba(0,200,5,0.15)" : s.key === "loser" ? "rgba(255,80,0,0.15)" : "#1a1a1a"
                  : "transparent",
                color: sortMode === s.key
                  ? s.key === "gainer" ? "#00c805" : s.key === "loser" ? "#ff5000" : "#fff"
                  : "#555",
                border: sortMode === s.key
                  ? s.key === "gainer" ? "1px solid rgba(0,200,5,0.3)" : s.key === "loser" ? "1px solid rgba(255,80,0,0.3)" : "1px solid #333"
                  : "1px solid transparent",
              }}
            >
              <span className="hidden sm:inline">{s.icon}{s.label}</span>
              <span className="sm:hidden">{s.icon}{s.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Tab content */}
      {activeTab === "holdings" && (
        <div style={{ borderTop: "1px solid #1a1a1a" }}>
          {held.length === 0 ? (
            <p className="py-8 text-center text-sm" style={{ color: "#666" }}>No open positions</p>
          ) : (
            held.map((p) => (
              <StockRow key={p.ticker} p={p} prices={prices} lastTrades={lastTrades} isClosed={false} />
            ))
          )}
        </div>
      )}

      {activeTab === "previously" && (
        <div className="space-y-1">
          {closed.length === 0 ? (
            <p className="py-8 text-center text-sm" style={{ color: "#666" }}>No previously owned stocks</p>
          ) : (
            closed.map((p) => (
              <StockRow key={p.ticker} p={p} prices={prices} lastTrades={lastTrades} isClosed={true} />
            ))
          )}
        </div>
      )}

      {activeTab === "recent" && (
        <div style={{ borderTop: "1px solid #1a1a1a" }}>
          {trades.slice(0, 15).map((t) => {
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
      )}
    </div>
  );
}
