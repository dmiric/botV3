import { Injectable } from "@nestjs/common";
import { TradeSession } from '../tradesession/models/tradesession.entity'

import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { HistCandlesService } from "src/candles/hist/histcandles.service";
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { CandleDbService } from "src/candles/candle.db.service";


@Injectable()
export class BackTestDataSource {

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

            if (data[3]['amount'] > 0) {
                const tu = [0, 'tu', [
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    data[3]['amount'],
                    null,
                    null,
                    data[3]['amount'] * data[3]['price'] * 0.002, // fee
                    null,
                    data[3]['cid']
                ]]
                await this.addToQueue(JSON.stringify(tu), 3)
            }

            if (data[3]['amount'] < 0) {
                const tu = [0, 'tu', [
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    data[3]['amount'],
                    null,
                    null,
                    data[3]['amount'] * data[3]['price'] * 0.002, // fee
                    null,
                    data[3]['cid']
                ]]
                await this.addToQueue(JSON.stringify(tu), 3)
            }
        }

    }

    async addToQueue(message: string, priority: number): Promise<void> {
        await this.botQueue.add(
            'trade',
            { message: message },
            { removeOnComplete: true, priority: priority }
        )
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    async open(socket: string, tradeSession: TradeSession): Promise<void> {
        dayjs.extend(utc)
        if (socket == 'candleSocket') {
            const endTime = tradeSession.endTime ? tradeSession.endTime : Date.now()
            await this.histCandlesService.prepareHistData(tradeSession)
            
            const candles = await this.candleDbService.getQueryBuilder()
                .select('*')
                .where('mts >= :startTime AND mts <= :endTime', {startTime: tradeSession.startTime, endTime: endTime})
                .andWhere('symbol = :symbol', { symbol: tradeSession.symbol} )
                .andWhere('timeframe = :timeframe', {timeframe: tradeSession.timeframe} )
                .getRawMany()

            for (const candle of candles) {
                const c = [0, [candle.mts, candle.open, candle.close, candle.high, candle.low, candle.volume]]
                await this.botQueue.add(
                    'candles',
                    { message: JSON.stringify(c) },
                    { removeOnComplete: true, priority: 4 }
                )
            }

            await this.botQueue.add(
                'candles',
                { message: 'end' },
                { removeOnComplete: true, priority: 10 }
                
            )
        }

        if (socket == 'orderSocket') {
            this.wu()
        }
    }

    async wu(): Promise<void> {
        setTimeout(
            () => {

                this.addToQueue(JSON.stringify(
                    [0, 'wu', ['exchange', 'USD', null, null, 50000]]
                ), 1)

                this.wu();
            }, 1000);
    }

}
