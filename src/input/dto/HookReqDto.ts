export class HookReqDto {
  action: string;
  symbol: string;
  startBalance?: number;
  safety?: string;
  timeframe?: string;
  safeDistance?: number;
  priceTrailing?: { 
    profit: number;
    distance: number;
  }
}