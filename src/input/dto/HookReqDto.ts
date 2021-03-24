export class HookReqDto {
  action: string;
  update?: boolean;
  symbol: string;
  strategy: string;
  exchange: string;
  startTime?: string;
  endTime?: string;
  timeframe?: string;
  buy: {
    buyRules: number;
    startBalance: number;
    investment: number;
    safeDistance: number;
    priceDiff: number;
    priceDiffLow?: string;    
  }
  sell: {
    sellRules: number;
    salesRules?: number[];
    trailingDistance: number;
    closePercent?: number;
  }
  safetyHash?: string;
}
