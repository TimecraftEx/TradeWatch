import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

interface PriceResult {
  price: number;
  change: number;
  changePercent: number;
}

async function fetchPrice(symbol: string): Promise<PriceResult | null> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({
        url: `https://stockanalysis.com/stocks/${symbol.toLowerCase()}/`,
        formats: ["markdown"],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content: string = data?.data?.markdown || "";
    const lines = content.split("\n").filter((l: string) => l.trim());
    let priceIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("Real-Time Price")) { priceIdx = i; break; }
    }
    if (priceIdx === -1) return null;
    let price = 0, change = 0, changePercent = 0;
    for (let i = priceIdx + 1; i < Math.min(priceIdx + 8, lines.length); i++) {
      const line = lines[i].trim();
      const pm = line.match(/^([\d,]+\.\d{2})$/);
      if (pm && !price) { price = parseFloat(pm[1].replace(/,/g, "")); continue; }
      const cm = line.match(/^([+-]?[\d,]+\.\d+)\s*\(([+-]?[\d.]+)%\)/);
      if (cm && price) { change = parseFloat(cm[1].replace(/,/g, "")); changePercent = parseFloat(cm[2]); break; }
    }
    return price > 0 ? { price, change, changePercent } : null;
  } catch { return null; }
}

export async function POST() {
  // 1. Get alert settings
  const { data: settings } = await supabase
    .from("alert_settings")
    .select("*")
    .limit(1)
    .single();

  if (!settings || !settings.enabled) {
    return NextResponse.json({ message: "Alerts disabled", triggered: [] });
  }

  const threshold = Number(settings.threshold_pct);
  const direction = settings.direction as string;

  // 2. Get held positions
  const { data: positions } = await supabase
    .from("positions")
    .select("*");

  const held = (positions || []).filter(
    (p: Record<string, unknown>) => p.status === "held" && Number(p.net_shares) > 0.01
  );

  if (held.length === 0) {
    return NextResponse.json({ message: "No held positions", triggered: [] });
  }

  // 3. Get last buy/sell per ticker
  const { data: trades } = await supabase
    .from("trades")
    .select("*")
    .order("executed_at", { ascending: false });

  const lastTrades: Record<string, { lastBuy: number | null; lastSell: number | null }> = {};
  for (const p of held) {
    const ticker = p.ticker as string;
    const tickerTrades = (trades || []).filter((t: Record<string, unknown>) => t.ticker === ticker);
    const lastBuy = tickerTrades.find((t: Record<string, unknown>) => t.action === "buy");
    const lastSell = tickerTrades.find((t: Record<string, unknown>) => t.action === "sell");
    lastTrades[ticker] = {
      lastBuy: lastBuy ? Number(lastBuy.price_per_share) : null,
      lastSell: lastSell ? Number(lastSell.price_per_share) : null,
    };
  }

  // 4. Fetch live prices
  const tickers = held.map((p: Record<string, unknown>) => p.ticker as string);
  const prices: Record<string, PriceResult> = {};
  await Promise.all(
    tickers.map(async (ticker) => {
      const result = await fetchPrice(ticker);
      if (result) prices[ticker] = result;
    })
  );

  // 5. Check alerts
  const triggered: Array<{
    ticker: string;
    alert_type: string;
    current_price: number;
    trade_price: number;
    threshold_price: number;
    pct_diff: number;
  }> = [];

  for (const ticker of tickers) {
    const currentPrice = prices[ticker]?.price;
    if (!currentPrice) continue;

    const lt = lastTrades[ticker];
    if (!lt) continue;

    // Check against last buy
    if ((direction === "below_buy" || direction === "both") && lt.lastBuy) {
      const thresholdPrice = lt.lastBuy * (1 - threshold / 100);
      if (currentPrice <= thresholdPrice) {
        triggered.push({
          ticker,
          alert_type: "pct_drop",
          current_price: currentPrice,
          trade_price: lt.lastBuy,
          threshold_price: thresholdPrice,
          pct_diff: ((currentPrice - lt.lastBuy) / lt.lastBuy) * 100,
        });
      }
    }

    // Check against last sell
    if ((direction === "below_sell" || direction === "both") && lt.lastSell) {
      const thresholdPrice = lt.lastSell * (1 - threshold / 100);
      if (currentPrice <= thresholdPrice) {
        triggered.push({
          ticker,
          alert_type: "pct_drop",
          current_price: currentPrice,
          trade_price: lt.lastSell,
          threshold_price: thresholdPrice,
          pct_diff: ((currentPrice - lt.lastSell) / lt.lastSell) * 100,
        });
      }
    }
  }

  // 6. Insert triggered alerts
  if (triggered.length > 0) {
    await supabase.from("price_alerts").insert(
      triggered.map((a) => ({
        ticker: a.ticker,
        alert_type: a.alert_type,
        current_price: a.current_price,
        trade_price: a.trade_price,
        threshold_price: a.threshold_price,
        notified_via: ["app"],
      }))
    );
  }

  return NextResponse.json({
    message: `Checked ${tickers.length} tickers, ${triggered.length} alerts triggered`,
    threshold: `${threshold}%`,
    triggered,
  });
}
