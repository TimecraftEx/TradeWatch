import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { readFile } from "fs/promises";
import { join } from "path";

const execAsync = promisify(exec);

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface PriceResult {
  price: number;
  change: number;
  changePercent: number;
}

async function scrapeTicker(symbol: string): Promise<PriceResult | null> {
  const outFile = join(process.cwd(), `.firecrawl`, `price-${symbol}.md`);

  try {
    await execAsync(
      `firecrawl scrape "https://stockanalysis.com/stocks/${symbol.toLowerCase()}/" -o "${outFile}"`,
      { timeout: 15000 }
    );

    const content = await readFile(outFile, "utf-8");

    // Parse price from pattern like:
    // "557.89\n\n+11.17 (2.04%)"
    // or "557.89\n\n-11.17 (-2.04%)"
    const lines = content.split("\n").filter((l) => l.trim());

    // Find the line with "Real-Time Price" then get the next non-empty lines
    let priceIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("Real-Time Price")) {
        priceIdx = i;
        break;
      }
    }

    if (priceIdx === -1) return null;

    // Price is typically 2-3 lines after "Real-Time Price"
    let price = 0;
    let change = 0;
    let changePercent = 0;

    for (let i = priceIdx + 1; i < Math.min(priceIdx + 6, lines.length); i++) {
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

  const symbols = tickers.split(",").map((t) => t.trim()).filter(Boolean);
  const results: Record<string, PriceResult> = {};

  // Scrape in parallel (firecrawl supports concurrent requests)
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
