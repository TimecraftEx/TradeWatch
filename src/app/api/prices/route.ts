import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const FIRECRAWL_URL = "https://api.firecrawl.dev/v1/scrape";

interface PriceResult {
  price: number;
  change: number;
  changePercent: number;
}

async function scrapeTicker(symbol: string): Promise<PriceResult | null> {
  try {
    const res = await fetch(FIRECRAWL_URL, {
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

    if (!content) return null;

    const lines = content.split("\n").filter((l: string) => l.trim());

    // Find "Real-Time Price" then parse price and change from nearby lines
    let priceIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("Real-Time Price")) {
        priceIdx = i;
        break;
      }
    }

    if (priceIdx === -1) return null;

    let price = 0;
    let change = 0;
    let changePercent = 0;

    for (let i = priceIdx + 1; i < Math.min(priceIdx + 8, lines.length); i++) {
      const line = lines[i].trim();

      // Match standalone price like "557.89" or "1,842.75"
      const priceMatch = line.match(/^([\d,]+\.\d{2})$/);
      if (priceMatch && !price) {
        price = parseFloat(priceMatch[1].replace(/,/g, ""));
        continue;
      }

      // Match change like "+11.17 (2.04%)" or "-11.17 (-2.04%)"
      const changeMatch = line.match(/^([+-]?[\d,]+\.\d+)\s*\(([+-]?[\d.]+)%\)/);
      if (changeMatch && price) {
        change = parseFloat(changeMatch[1].replace(/,/g, ""));
        changePercent = parseFloat(changeMatch[2]);
        break;
      }
    }

    if (price > 0) {
      return { price, change, changePercent };
    }

    return null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tickers = searchParams.get("tickers");

  if (!tickers) {
    return NextResponse.json({ error: "tickers param required" }, { status: 400 });
  }

  if (!FIRECRAWL_API_KEY) {
    return NextResponse.json({ error: "FIRECRAWL_API_KEY not configured" }, { status: 500 });
  }

  const symbols = tickers.split(",").map((t) => t.trim()).filter(Boolean);
  const results: Record<string, PriceResult> = {};

  // Scrape in parallel
  await Promise.all(
    symbols.map(async (symbol) => {
      const result = await scrapeTicker(symbol);
      if (result) {
        results[symbol] = result;
      }
    })
  );

  return NextResponse.json(results);
}
