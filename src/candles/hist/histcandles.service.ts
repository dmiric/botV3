import { Injectable } from '@nestjs/common'
import fetch from 'node-fetch'
import { Period } from '../../interfaces/period.model'
import { padCandles } from 'bfx-api-node-util'
import { candleWidth } from 'bfx-hf-util'
import { TradeSession } from '../../tradesession/models/tradesession.entity';
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { CandleDbService } from '../candle.db.service';
import { Candle } from '../models/candle.entity';


@Injectable()
export class HistCandlesService {

    constructor(private readonly candleDbService: CandleDbService) { }

    async prepareHistData(tradeSession: TradeSession): Promise<void> {
        const timeframes = [tradeSession.timeframe, '1m']

        for (const timeframe of timeframes) {
            if (timeframe === undefined) {
                continue;
            }

            await this.updateCandles(timeframe, tradeSession.symbol)
        }
    }

    private async updateCandles(timeframe: string, symbol: string): Promise<void> {
        const pathParamsData = "trade:" + timeframe + ":" + symbol;
        const candleWidthVal = candleWidth(timeframe)

        const qb2 = this.candleDbService.getQueryBuilder()
        const lastCandleTime = await qb2
            .select("MAX(mts)", "mts")
            .where("timeframe = :timeframe", { timeframe: timeframe })
            .andWhere("symbol = :symbol", { symbol: symbol })
            .getRawOne()

        let start = null
        if (lastCandleTime && lastCandleTime.mts > 0) {
            start = lastCandleTime.mts
        }

        const periods: Period[] = this.getTimeStamps(start)

        if(periods.length < 2) {
            return
        }

        for (const period of periods) {
            console.log(timeframe + ' ' + period.year + ' ' + period.month)

            let queryParams = 'limit=10000&sort=1&start=' + period.smts + '&end=' + period.emts
            if (period.current) {
                queryParams = 'limit=10000&sort=1&start=' + period.smts
            }

            const data = await this.processRestData(pathParamsData, candleWidthVal, queryParams)

            for (const candleData of data) {
                if(start && start > candleData[0]) {
                    continue
                }
                await this.saveCandle(candleData, timeframe, symbol)
            }
        }
    }

    private async saveCandle(candleData: number|string[], timeframe: string, symbol: string): Promise<void> {
        const candle: Candle = {
            mts: candleData[0],
            open: candleData[1],
            close: candleData[2],
            high: candleData[3],
            low: candleData[4],
            volume: candleData[5],
            timeframe: timeframe,
            symbol: symbol
        }
        await this.candleDbService.create(candle)
    }

    private async processRestData(pathParamsData: string, candleWidthVal: number, queryParams: string): Promise<number[]> {
        const data = await this.getRestData(pathParamsData, queryParams);
        if (data[0] == 'error') {
            throw console.error("Candle Error!");

        }
        return padCandles(data, candleWidthVal)
    }

    private getTimeStamps(start?: number): Period[] {
        dayjs.extend(utc)
        const currentDate = new Date()
        const currentYear = currentDate.getUTCFullYear()
        const currentMonth = currentDate.getUTCMonth()
        const currentDay = currentDate.getUTCDate()

        const date1 = dayjs.utc(start ? start : '2020')
        const date2 = dayjs.utc(currentDate)

        const diff = date2.diff(date1, 'day')

        const periods = []
        for (let p = 0; p <= diff; p++) {
            const next = dayjs.utc(date1).add(p, 'day').startOf('day')
            periods.push({
                smts: next.valueOf(),
                emts: dayjs.utc(next).endOf('day').valueOf(),
                year: next.year(),
                month: next.month(),
                current: next.date() == currentDay && next.month() == currentMonth && next.year() == currentYear ? true : false,
            })
        }
        return periods;
    }

    private async getRestData(pathParamsData: string, queryParams: string): Promise<any> {
        // wait 600ms delay so we don't hit the rate limit
        await new Promise(r => setTimeout(r, 300));

        const url = 'https://api-pub.bitfinex.com/v2'

        const pathParams = 'candles/' + pathParamsData + '/hist' // Change these based on relevant path params. /last for last candle

        try {
            const req = await fetch(`${url}/${pathParams}?${queryParams}`)
            const response = await req.json()
            return response;
        }
        catch (err) {
            console.log(err)
        }
    }

}
