import { Injectable } from "@nestjs/common";
import { TradeSession } from '../tradesession/models/tradesession.entity'

import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { HistCandlesService } from '../candles/hist/histcandles.service'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { CandleDbService } from '../candles/candle.db.service'
import { candleWidth } from 'bfx-hf-util'


@Injectable()
export class BackTestDataSource {

    private call = 0

    constructor(
        @InjectQueue('bot') private readonly botQueue: Queue,
        private readonly histCandlesService: HistCandlesService,
        private readonly candleDbService: CandleDbService
    ) { }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    async send(socket: string, data: any): Promise<void> {

        if (data[1] == 'on') {
            const n = [0, 'n', [null, null, null, null, [
                data[3]['cid'],
                null,
                data[3]['cid'],
                data[3]['symbol'],
                null,
                null,
                data[3]['amount']
            ]]]
            await this.addToQueue(JSON.stringify(n), 1)
            await new Promise(r => setTimeout(r, 30));

            const on = [0, 'on', [
                data[3]['cid'],
                null,
                data[3]['cid'],
                data[3]['symbol'],
                null,
                null,
                data[3]['amount'],
                data[3]['type']
            ]]
            await this.addToQueue(JSON.stringify(on), 2)
            await new Promise(r => setTimeout(r, 30));
        }

        if (data[1] == 'oc') {
            const oc = [0, 'oc', [
                data[3]['cid'],
                null,
                data[3]['cid'],
                data[3]['symbol'],
                null,
                null,
                data[3]['amount'],
                data[3]['type']
            ]]
            await this.addToQueue(JSON.stringify(oc), 1)
            await new Promise(r => setTimeout(r, 30));
        }


        if (data[1] == 'tu') {
            const tu = [0, 'tu', [
                null,
                null,
                null,
                null,
                data[2][4],
                null,
                null,
                null,
                null,
                data[2][4] * data[2][5] * 0.002, // fee
                null,
                data[2][11]
            ]]
            await this.addToQueue(JSON.stringify(tu), 1)
        }
    }

    // We need this here dont delete
    checkActivity(): boolean {
        return true
    }

    async addToQueue(message: string, priority: number): Promise<void> {
        await this.botQueue.add(
            'trade',
            { message: message },
            { removeOnComplete: true, priority: priority }
        )
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    async openCandle(tradeSession: TradeSession): Promise<void> {
        dayjs.extend(utc)

        const endTime = tradeSession.endTime ? tradeSession.endTime : Date.now()
        console.log(this.call++)
        await this.histCandlesService.prepareHistData(tradeSession)

        const c = this.candleDbService.getQueryBuilder()
            .select('*')
            .where('mts >= :startTime AND mts <= :endTime', { startTime: tradeSession.startTime, endTime: endTime })
            .andWhere('symbol = :symbol', { symbol: tradeSession.symbol })
            .andWhere('timeframe = :timeframe', { timeframe: tradeSession.timeframe })

        const candles = await c.getRawMany()

        let ma = null
        if (tradeSession.ma != null) {
            const cw = candleWidth(tradeSession.timeframe)

            // get startTime - MA days so we can calc. MA
            const startTime = tradeSession.startTime - (cw * tradeSession.ma)

            const avg = this.candleDbService.getQueryBuilder()
                .select('*')
                .where('mts >= :startTime AND mts <= :endTime', { startTime: startTime, endTime: endTime })
                .andWhere('symbol = :symbol', { symbol: tradeSession.symbol })
                .andWhere('timeframe = :timeframe', { timeframe: tradeSession.timeframe })
            avg.addSelect("AVG(close) OVER(ORDER BY mts ROWS BETWEEN " + tradeSession.ma + " PRECEDING AND CURRENT ROW )", "ma")

            ma = await avg.getRawMany()
        }

        for (const [i, candle] of candles.entries()) {
            const c = [100, [candle.mts, candle.open, candle.close, candle.high, candle.low, candle.volume, null]]

            // add ma to a candle
            if (ma != null) {
                for (const [index, m] of ma.entries()) {
                    if (m.mts == candle.mts) {
                        c[1][6] = m.ma
                        ma.splice(0, index);
                        break
                    }
                }
            }

            await this.addToQueue(JSON.stringify(c), 4)

            // add 1m candles for calculating trailing orders
            const candles_1m = this.candleDbService.getQueryBuilder()
                .select('*')
                .where('mts >= :startTime', { startTime: candle.mts })
                .andWhere('symbol = :symbol', { symbol: tradeSession.symbol })
                .andWhere('timeframe = :timeframe', { timeframe: '1m' })

            if (candles[i + 1]) {
                candles_1m.andWhere("mts <= :endTime", { endTime: candles[i + 1].mts })
            }

            const candles_1m_r = await candles_1m.getRawMany()

            for (const candle_1m of candles_1m_r) {
                const c1m = [100, [candle_1m.mts, candle_1m.open, candle_1m.close, candle_1m.high, candle_1m.low, candle_1m.volume, null]]
                await this.addToQueue(JSON.stringify(c1m), 4)
            }
        }

        await this.addToQueue(JSON.stringify('end'), 10)        
    }

    async openOrder(): Promise<void> {
        const wu = [0, 'wu', ['exchange', 'USD', null, null, 50000]]
        await this.addToQueue(JSON.stringify(wu), 1)   
    }

    close(): void { return }

}
