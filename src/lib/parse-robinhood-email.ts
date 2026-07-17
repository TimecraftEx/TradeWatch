export interface ParsedTrade {
  ticker: string;
  action: 'buy' | 'sell';
  shares: number;
  pricePerShare: number;
  totalAmount: number;
  executedAt: Date;
}

/**
 * Parses a Robinhood "Your order has been executed" email.
 * Handles both snippet text and full email body (collapsed to single line).
 *
 * Buy formats:
 *   Snippet: "Your order to buy $3,000.00 of RKLB ..."
 *   Body:    "You paid $3,000.00 for 28.383556 shares, at an average price of $105.70 per share."
 *
 * Sell formats:
 *   Share sell:  "Your order to sell 38.296583 shares of IBM ... at an average price of $273.07"
 *   Dollar sell: "Your order to sell $5,000.00 of MU ... You received $5,000.00 for 5.00 shares ..."
 */
export function parseRobinhoodEmail(snippet: string, emailDate: string): ParsedTrade | null {
  const text = snippet.replace(/\s+/g, ' ').trim();
  const executedAt = parseDateFromSnippet(text) || new Date(emailDate);

  // Extract ticker from "of [TICKER]" near "order to buy/sell"
  const tickerMatch = text.match(/order to (?:buy|sell) .*?of ([A-Z]{1,5})(?:\s|$|through|\.|,)/);
  const ticker = tickerMatch?.[1];

  // --- BUY patterns ---
  if (/order to buy/i.test(text) && ticker) {
    // Pattern 1: "You paid $X for Y shares, at an average price of $Z per share"
    const paidMatch = text.match(
      /paid \$([\d,]+\.\d{2}) for ([\d.]+) shares.*?average price of \$([\d,]+\.\d{2})/
    );
    if (paidMatch) {
      return {
        ticker,
        action: 'buy',
        totalAmount: parseFloat(paidMatch[1].replace(/,/g, '')),
        shares: parseFloat(paidMatch[2]),
        pricePerShare: parseFloat(paidMatch[3].replace(/,/g, '')),
        executedAt,
      };
    }

    // Pattern 2: compact snippet "buy $X of TICKER ... Y shares ... average price of $Z"
    const buyMatch = text.match(
      /buy \$([\d,]+\.\d{2}) of [A-Z]{1,5}.*?([\d]+\.[\d]+)\s*shares.*?average price of \$([\d,]+\.\d{2})/
    );
    if (buyMatch) {
      return {
        ticker,
        action: 'buy',
        totalAmount: parseFloat(buyMatch[1].replace(/,/g, '')),
        shares: parseFloat(buyMatch[2]),
        pricePerShare: parseFloat(buyMatch[3].replace(/,/g, '')),
        executedAt,
      };
    }
  }

  // --- SELL patterns ---
  if (/order to sell/i.test(text) && ticker) {
    // Pattern 1: "sell N shares of TICKER ... average price of $X" (share-count sell)
    const sellShareMatch = text.match(
      /sell ([\d.]+)\s*shares of [A-Z]{1,5}.*?average price of \$([\d,]+\.\d{2})/
    );
    if (sellShareMatch) {
      const shares = parseFloat(sellShareMatch[1]);
      const pricePerShare = parseFloat(sellShareMatch[2].replace(/,/g, ''));
      return {
        ticker,
        action: 'sell',
        shares,
        pricePerShare,
        totalAmount: Math.round(shares * pricePerShare * 100) / 100,
        executedAt,
      };
    }

    // Pattern 2: dollar-amount sell — body has "Y shares ... average price of $Z"
    const sellBodyMatch = text.match(
      /(?:received|sold).*?([\d.]+)\s*shares.*?average price of \$([\d,]+\.\d{2})/
    );
    if (sellBodyMatch) {
      const shares = parseFloat(sellBodyMatch[1]);
      const pricePerShare = parseFloat(sellBodyMatch[2].replace(/,/g, ''));
      return {
        ticker,
        action: 'sell',
        shares,
        pricePerShare,
        totalAmount: Math.round(shares * pricePerShare * 100) / 100,
        executedAt,
      };
    }
  }

  return null;
}

function parseDateFromSnippet(snippet: string): Date | null {
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
