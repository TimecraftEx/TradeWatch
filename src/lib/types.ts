export interface Trade {
  id: string;
  ticker: string;
  action: 'buy' | 'sell';
  shares: number;
  price_per_share: number;
  total_amount: number;
  executed_at: string;
  gmail_message_id: string | null;
  created_at: string;
}

export interface Position {
  ticker: string;
  total_bought: number;
  total_sold: number;
  net_shares: number;
  avg_cost_basis: number;
  status: 'held' | 'closed';
  total_invested: number;
  total_returned: number;
  realized_pnl: number;
}

export interface PriceAlert {
  id: string;
  ticker: string;
  alert_type: '5_day_low' | '7_day_low' | 'pct_drop';
  threshold_price: number;
  current_price: number;
  trade_price: number;
  triggered_at: string;
  notified_via: string[];
  created_at: string;
}

export interface PriceHistory {
  id: string;
  ticker: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface AlertSettings {
  id: string;
  threshold_pct: number;
  direction: 'below_buy' | 'below_sell' | 'both';
  enabled: boolean;
  updated_at: string;
}

export interface LastTrade {
  ticker: string;
  last_buy_price: number | null;
  last_buy_date: string | null;
  last_sell_price: number | null;
  last_sell_date: string | null;
}

export interface PortfolioSummary {
  totalInvested: number;
  totalReturned: number;
  netPnL: number;
  winRate: number;
  totalTrades: number;
  heldPositions: number;
  closedPositions: number;
}
