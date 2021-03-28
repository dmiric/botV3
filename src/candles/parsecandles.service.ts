import { Injectable } from '@nestjs/common';
import { Candle } from '../interfaces/candle.model'
import { candleWidth } from 'bfx-hf-util'
import { TradeSession } from '../tradesession/models/tradesession.entity';
@Injectable()
export class ParseCandlesService {

    private keepHistCandles = null
    private lastMA = null

    handleCandleStream(data: number[][][], tradeSession: TradeSession, candleSet: Candle[]): Candle[] {
        const candleWidthVal = candleWidth(tradeSession.timeframe)

        if(this.keepHistCandles == null || this.lastMA != tradeSession.ma) {
            this.lastMA = tradeSession.ma ? tradeSession.ma : 5000
            this.keepHistCandles = this.lastMA + 1
        }

        const set = this.parseSet(data)
        if(set.length > 0) {
            return set; 
        }

        const singleCandleRaw = <Array<any>>data[1];
        const candle = this.convertToObject(<Array<number>>singleCandleRaw)
        //console.log(candle)

        const currentDate = new Date();
        const currentTimestamp = currentDate.getTime();

        const diff = currentTimestamp - candle.mts;

        // if there are no candles in history push first that occures in the stream
        if (candleSet.length < 1) {
            candleSet.push(candle);
        }

        // push all unique closed candles to the history
        const previousCandle = candleSet[candleSet.length - 1];
        if (diff > candleWidthVal && previousCandle.mts !== candle.mts) {
            candleSet.push(candle);
            // insert service that checks for pattern here
            candleSet = this.trimHistCandles(candleSet);
        }

        candleSet[-1] = candle
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
            const keep: number[][] = data[1].slice(-Math.abs(this.keepHistCandles));
            keep.forEach(candleData => {
                candleSet.push(this.convertToObject(candleData));
            });
        }

        return candleSet;
    }

    // keep this.keepHistCandles candles in this.histCandles
    private trimHistCandles(candleSet: Candle[]): Candle[] {
        return candleSet.slice(-Math.abs(this.keepHistCandles))
    }

}
