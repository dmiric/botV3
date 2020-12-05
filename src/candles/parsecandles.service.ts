import { Injectable } from '@nestjs/common';
import { Key, TestingKey } from '../interfaces/key.model'
import { Candle } from '../interfaces/candle.model'
import { Candle as CandleObj } from 'bfx-api-node-models'
import { candleWidth } from 'bfx-hf-util'


@Injectable()
export class ParseCandlesService {

    private keepHistCandles = 2000
    private histCandles: Candle[] = [];
    private candleWidthVal: number

    handleCandleStream(data: number[][], key: Key|TestingKey, candleSet: Candle[]): Candle[] {
        if (candleSet.length > 0) {
            this.histCandles = candleSet;
        } else {
            this.histCandles = []
        }
        this.setCandleWidth(key)

        if (!this.isCandle(data)) {
            return;
        }
        const singleCandleRaw = <Array<any>>data[0];
        const candle = this.convertToObject(<Array<number>>singleCandleRaw)
        //console.log(candle)

        const currentDate = new Date();
        const currentTimestamp = currentDate.getTime();

        const diff = currentTimestamp - candle.mts;

        // if there are no candles in history push first that occures in the stream
        if (this.histCandles.length < 1) {
            this.histCandles.push(candle);
        }

        // push all unique closed candles to the history
        const previousCandle = this.histCandles[this.histCandles.length - 1];
        if (diff > this.candleWidthVal && previousCandle.mts !== candle.mts) {
            this.histCandles.push(candle);
            // insert service that checks for pattern here
            this.trimHistCandles();
        }

        return this.histCandles;
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

    private isCandle(data: number[][]): boolean {
        if (data.length > 6) {
            this.populateHistCandles(data)
            return false;
        }

        if (typeof data[0][0] === 'number') {
            // is a single candle
            return true;
        }

        return false;
    }

    private populateHistCandles(data: number[][]): void {
        const keep: number[][] = data.slice(-Math.abs(this.keepHistCandles));
        keep.forEach(candleData => {
            this.histCandles.push(this.convertToObject(candleData));
        });
    }

    // keep this.keepHistCandles candles in this.histCandles
    private trimHistCandles(): void {
        this.histCandles = this.histCandles.slice(-Math.abs(this.keepHistCandles))
    }

    private setCandleWidth(key: Key): void {
        // calculate candle width in ms
        this.candleWidthVal = candleWidth(key.timeframe)
    }

}
