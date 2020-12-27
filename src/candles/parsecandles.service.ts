import { Injectable } from '@nestjs/common';
import { Key } from '../interfaces/key.model'
import { Candle } from '../interfaces/candle.model'
import { Candle as CandleObj } from 'bfx-api-node-models'
import { candleWidth } from 'bfx-hf-util'


@Injectable()
export class ParseCandlesService {

    private keepHistCandles = 2000

    handleCandleStream(data: number[][], key: Key, candleSet: Candle[]): Candle[] {
        const candleWidthVal = candleWidth(key.timeframe)

        const set = this.parseSet(data)
        if(set.length > 0) {
            return set; 
        }

        const singleCandleRaw = <Array<any>>data[0];
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

        return candleSet;
    }

    // move this to separate candle.service that extends Candle?
    convertToObject(candleData: number[]): undefined | any {
        if (candleData.length < 6) {
            return
        }

        const candle: Candle = new CandleObj(candleData)
        return candle;
    }

    timeframeToMs(timeframe: string): number {
        return candleWidth(timeframe)
    }

    private parseSet(data: number[][]): Candle[] {
        const candleSet: Candle[] = [];
        if (data.length > 6) {
            const keep: number[][] = data.slice(-Math.abs(this.keepHistCandles));
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
