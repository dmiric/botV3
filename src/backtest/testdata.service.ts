import { Injectable } from '@nestjs/common';

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TradeSession } from '../tradesession/models/tradesession.entity';

@Injectable()
export class TestDataService {

    private cryptoXlsDir = path.join(os.homedir(), 'Documents', 'CryptoXLS')

    async getCandles(tradeSession: TradeSession): Promise<number[][]> {
        const path = this.prepareFilePath(tradeSession)

        let file = this.getCandlesFile(path)
        if (!file) {
            return
        }
        if (file.charAt(file.length - 1) === ',') {
            file = file.substring(0, file.length - 1);
        }

        const candles = JSON.parse('[' + file + ']')

        const trimmed = this.trimStack(candles, tradeSession)
        return trimmed
    }


    private trimStack(candles: number[][], tradeSession: TradeSession): number[][] {
        const start = this.findCandleByTimestamp(candles, tradeSession.startTime)
        const end = this.findCandleByTimestamp(candles, tradeSession.endTime)

        if(start < 0 && end < 0) {
            return candles
        }
        
        if(end < 0) {
            return candles.slice(start)
        }
        
        return candles.slice(start, end)
    }

    private findCandleByTimestamp(candles: number[][], mts: number): number {
        return candles.findIndex(candle => {
            if (candle[0] == mts) {
                return true
            }
        });
    }

    private prepareFilePath(tradeSession: TradeSession): string {
        const startDate = new Date(tradeSession.startTime)
        const startYear = startDate.getUTCFullYear()
        const startMonth = startDate.getUTCMonth()
        return path.join(this.cryptoXlsDir, tradeSession.symbol, 'hist', tradeSession.timeframe,
            startYear + '-' + startMonth + '.csv');
    }

    private getCandlesFile(filePath: string): string {
        if (!fs.existsSync(filePath)) return;
        return fs.readFileSync(filePath, 'utf8')
    }

}