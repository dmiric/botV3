export class HookReqDto {
  action: string;
  symbol: string;
  closePercent?: number;
  startBalance?: number;
  safety?: string;
  timeframe?: string;
  safeDistance?: number;
  priceTrailing?: { 
    profit: number;
    distance: number;
  }
}