export interface Key {
  trade: string;
  timeframe: string;
  symbol: string;
}

export interface TestingKey extends Key {
  start: number;
  end: number;
} 