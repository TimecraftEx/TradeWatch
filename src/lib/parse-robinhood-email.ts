export interface ParsedTrade {
  ticker: string;
  action: 'buy' | 'sell';
  shares: number;
  pricePerShare: number;
  totalAmount: number;
  executedAt: Date;
}

/**
 * Parses a Robinhood "Your order has been executed" email snippet.
 *
 * Buy format:
 *   "Your order to buy $3,000.00 of RKLB ... You paid $3,000.00 for 28.383556 shares,
 *    at an average price of $105.70 per share."
 *
 * Sell format:
 *   "Your order to sell 38.296583 shares of IBM ... executed at an average price of $273.07
 *    on June 30, 2026 at 9:33 AM ET."
 */
export function parseRobinhoodEmail(snippet: string, emailDate: string): ParsedTrade | null {
  // Try buy pattern
  const buyMatch = snippet.match(
    /order to buy \$([\d,]+\.\d{2}) of ([A-Z]{1,5}).*?(\d+[\d.]*)\s*shares.*?average price of \$([\d,]+\.\d{2})/
  );
  if (buyMatch) {
    const totalAmount = parseFloat(buyMatch[1].replace(/,/g, ''));
    const ticker = buyMatch[2];
    const shares = parseFloat(buyMatch[3]);
    const pricePerShare = parseFloat(buyMatch[4].replace(/,/g, ''));
    return {
      ticker,
      action: 'buy',
      shares,
      pricePerShare,
      totalAmount,
      executedAt: parseDateFromSnippet(snippet) || new Date(emailDate),
    };
  }

  // Try sell pattern
  const sellMatch = snippet.match(
    /order to sell ([\d.]+)\s*shares of ([A-Z]{1,5}).*?average price of \$([\d,]+\.\d{2})/
  );
  if (sellMatch) {
    const shares = parseFloat(sellMatch[1]);
    const ticker = sellMatch[2];
    const pricePerShare = parseFloat(sellMatch[3].replace(/,/g, ''));
    const totalAmount = shares * pricePerShare;
    return {
      ticker,
      action: 'sell',
      shares,
      pricePerShare,
      totalAmount,
      executedAt: parseDateFromSnippet(snippet) || new Date(emailDate),
    };
  }

  return null;
}

function parseDateFromSnippet(snippet: string): Date | null {
  // Match "on June 30, 2026 at 9:33 AM ET" or "on July 2, 2026 at 9:45 AM ET"
  const dateMatch = snippet.match(
    /on ([A-Z][a-z]+ \d{1,2}, \d{4}) at (\d{1,2}:\d{2} [AP]M) ET/
  );
  if (dateMatch) {
    const dateStr = `${dateMatch[1]} ${dateMatch[2]}`;
    const parsed = new Date(dateStr + ' EDT');
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return null;
}
