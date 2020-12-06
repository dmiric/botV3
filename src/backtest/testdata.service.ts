import { Injectable } from '@nestjs/common';

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { convertCSVToArray } from 'convert-csv-to-array'
import { TestingKey } from '../interfaces/key.model';
import { candleWidth } from 'bfx-hf-util'

@Injectable()
export class TestDataService {

    private cryptoXlsDir = path.join(os.homedir(), 'Documents', 'CryptoXLS')
    private candleCache = []

    getCandles(testingKey: TestingKey): any {
        const indicatorOffset = testingKey.indicatorOffset * candleWidth(testingKey.timeframe)
        // from key get
        const startTime = testingKey.start - indicatorOffset
        const path = this.prepareFilePath(testingKey, startTime)

        const candles = this.getFromCache(path)
        if(candles) {
            return this.removeCandlesBeforeStart(candles, startTime)
        } else {
            const file = this.getCandlesFile(path)
            const candles = this.convertToArray(file)
            this.setCache(path, candles)
            return this.removeCandlesBeforeStart(candles, startTime)
        }   
    }

    private getFromCache(path: string) {
        const hash = "h" + this.hashCode(path)

        if(this.candleCache[hash]) {
            return [...this.candleCache[hash]]
        }

        return false
    }

    private setCache(path: string, candles) {
        const hash = "h" + this.hashCode(path)
        this.candleCache[hash] = [...candles]
    }

    private hashCode(str: string): number {
        let hash = 0, i = 0;
        const len = str.length;
        while ( i < len ) {
            hash  = ((hash << 5) - hash + str.charCodeAt(i++)) << 0;
        }
        return hash;
    }

    private removeCandlesBeforeStart(candles: number[][], datetime: number): number[][] {
        const index = this.findCandleByTimestamp(candles, datetime)
        return candles.splice(index)
    }

    private findCandleByTimestamp(candles: number[][], datetime: number): number {
        return candles.findIndex(candle => {
            if(candle[0] == datetime) {
                return true
            }
        });
    }

    private prepareFilePath(testingKey: TestingKey, startTime: number): string {
        const startDate = new Date(startTime)
        const startYear = startDate.getUTCFullYear()
        const startMonth = startDate.getUTCMonth()
        return path.join(this.cryptoXlsDir, testingKey.symbol, 'hist', testingKey.timeframe,
        startYear + '-' + startMonth + '.csv');
    }
    
    private getCandlesFile(filePath: string): string {
        if (!fs.existsSync(filePath)) throw new Error(`Cannot find ${filePath}`);
        return fs.readFileSync(filePath, 'utf8')
    }

    private convertToArray(data: string): number[][] {
        const candles = convertCSVToArray(data, {
            type: 'array',
            separator: ',',
        });

        return candles;
    }

}
