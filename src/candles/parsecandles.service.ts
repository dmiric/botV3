import { Injectable } from '@nestjs/common';
import { Candle } from '../interfaces/candle.model'
import { candleWidth } from 'bfx-hf-util'
import { TradeSession } from '../tradesession/models/tradesession.entity';
@Injectable()
export class ParseCandlesService {

    private keepHistCandles = null
    private lastMA = null

    handleCandleStream(data: number[][][], tradeSession: TradeSession, candleSet: Candle[]): Candle[] {
        if (this.keepHistCandles == null || this.lastMA != tradeSession.ma) {
            this.lastMA = tradeSession.ma ? tradeSession.ma : 5000
            this.keepHistCandles = this.lastMA + 1
        }

        const set = this.parseSet(data)
        if (set.length > 0) {
            return set;
        }

        const singleCandleRaw: any = data[1];
        const candle = this.convertToObject(singleCandleRaw)

        // if there are no candles in history push first that occures in the stream
        if (candleSet.length < 1) {
            candleSet.push(candle);
        }

        // push all unique closed candles to the history
        candleSet = this.appendCandleSet(candleSet, candle, tradeSession);

        return candleSet;
    }

    private appendCandleSet(candleSet: Candle[], candle: Candle, tradeSession: TradeSession) {
        let previousCandle = candleSet[candleSet.length - 1];

        if (tradeSession.exchange != 'backtest') {
            const candleWidthVal = candleWidth(tradeSession.timeframe)

            const currentDate = new Date();
            const currentTimestamp = currentDate.getTime();

            const diff = currentTimestamp - candle.mts;

            if (diff > candleWidthVal && previousCandle.mts !== candle.mts) {
                candleSet.push(candle);
                candleSet = this.trimHistCandles(candleSet);
            }
        }

        if (tradeSession.exchange == 'backtest' && candle.ma > 0) {
            candleSet.push(candle);
            candleSet = this.trimHistCandles(candleSet);
        }

        // add last tick
        candleSet[-1] = candle

        if (tradeSession.exchange == 'backtest' && candle.ma == null) {
            previousCandle = candleSet[candleSet.length - 1];
            candleSet[-1].ma = previousCandle.ma
        }

        return candleSet;
    }

    // move this to separate candle.service that extends Candle?
    convertToObject(candleData: number[]): undefined | any {
        if (candleData.length < 6) {
            return
        }

        return {
            mts: candleData[0],
            open: candleData[1],
            close: candleData[2],
            high: candleData[3],
            low: candleData[4],
            volume: candleData[5],
            ma: candleData[6]
        }
    }

    timeframeToMs(timeframe: string): number {
        return candleWidth(timeframe)
    }

    private parseSet(data: number[][][]): Candle[] {
        const candleSet: Candle[] = [];
        if (data[1].length > 50) {
            data[1].forEach(candleData => {
                candleSet.push(this.convertToObject(candleData));
            });
        }

        return candleSet.reverse();
    }

    // keep this.keepHistCandles candles in this.histCandles
    private trimHistCandles(candleSet: Candle[]): Candle[] {
        return candleSet.slice(Math.max(candleSet.length - this.keepHistCandles, 0))
    }

}
