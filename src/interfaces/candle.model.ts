export interface Candle {
    mts: number;
    open: number;
    close: number;
    high: number;
    low: number;
    volume: number;
    ma?: number;
}