export interface Key {
  trade: string;
  timeframe: string;
  symbol: string;
  indicatorOffset: number;
}

export interface TestingKey extends Key {
  start: number;
  end: number;
} 