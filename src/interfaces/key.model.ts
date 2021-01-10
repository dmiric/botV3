export interface Key {
  id?: string;
  action: string;
  logDates?: number[];
  trade: string;
  timeframe?: string;
  symbol: string;
  indicatorOffset?: number;
  start?: number;
  end?: number;
  orderlimit?: number;
  startBalance?: number;
  safeDistance?: number;
  trailingProfit?: number;
  trailingDistance?: number;
}