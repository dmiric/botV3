export interface StatsItem {
    id?: string;
    action: string;
    timeframe?: string;
    symbol: string;
    start?: number;
    end?: number;
    startBalance?: number;
    safeDistance?: number;
    trailingProfit?: number;
    trailingDistance?: number;
    closePercent?: number;
    manualTrailingProfit?: number;
    manualTrailingDistance?: number;
  }