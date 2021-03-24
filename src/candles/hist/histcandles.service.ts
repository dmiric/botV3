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

    private updatedTimeFrames = []

    constructor(private readonly candleDbService: CandleDbService) {}
/*
    async prepareHistData1(tradeSession: TradeSession): Promise<any> {

        if (this.updatedTimeFrames != null) {
            for (const tf of this.updatedTimeFrames) {
                if(tradeSession.timeframe == tf.timeframe && tradeSession.symbol == tf.symbol) {
                    return
                }
            }
        }
        this.updatedTimeFrames.push({ timeframe: tradeSession.timeframe, symbol: tradeSession.symbol })

        const periods: Period[] = this.getTimeStamps(tradeSession)
        const timeframes = [tradeSession.timeframe]
        const passedTimeFrames = []
        const symbol = tradeSession.symbol

        for (const timeframe of timeframes) {
            if (timeframe === undefined) {
                continue
            }
           
            const qb1 = this.candleDbService.getQueryBuilder()
            const count = await qb1
            .select("mts")
            .where("timeframe = :timeframe", { timeframe: tradeSession.timeframe })
            .andWhere("symbol = :symbol", { status: tradeSession.symbol })
            .getCount()

            if(count > 100) {
                continue
            }

            const candleWidthVal = candleWidth(timeframe)
            // check if we already delt with the same timeframe in this session 
            if (passedTimeFrames.includes(timeframe)) {
                continue
            }
            passedTimeFrames.push(timeframe)
            for (const period of periods) {
                const pathParamsData = "trade:" + timeframe + ":" + symbol;

                const startTime = period.smts
                const endTime = period.emts

                let queryParams = 'limit=10000&sort=1&start=' + startTime + '&end=' + endTime

                if (period.current) {
                    queryParams = 'limit=10000&sort=1&start=' + startTime
                }

                if (timeframe == '1m') {
                    const offset = 4 * 24 * 60 * 60 * 1000; // 7200 candles at once
                    const timeSplits = []
                    for (let i = 0; i < 8; i++) {
                        let splitEnd = startTime + (offset * (i + 1))

                        if (splitEnd > endTime) {
                            splitEnd = endTime
                            timeSplits.push([startTime + (offset * i), splitEnd])
                            break;
                        }
                        // this is 8 iterations to get all candles from that month
                        timeSplits.push([startTime + (offset * i), startTime + (offset * (i + 1))])
                    }

                    const stream = fs.createWriteStream(filePath, { flags: 'a' });

                    for (const timeSplit of timeSplits) {
                        queryParams = 'limit=10000&sort=1&start=' + timeSplit[0] + '&end=' + timeSplit[1]
                        csv = await this.processRestData(pathParamsData, candleWidthVal, queryParams)
                        if (csv != 'error') {
                            stream.write(csv + ',');
                            console.log('Saving 1m candles: ' + timeSplit[0] + ':' + timeSplit[1] + ' ' + filePath);
                        }
                    }
                    stream.end();
                    continue;
                }


                csv = await this.processRestData(pathParamsData, candleWidthVal, queryParams)

                // write CSV to a file
                fse.outputFileSync(filePath, csv, err => {
                    if (err) {
                        console.log(err);
                    } else {
                        console.log('Saving candles: ' + filePath);
                    }
                })
            }
        }

        return "done";
    }
*/
    async prepareHistData(tradeSession: TradeSession): Promise<any> {

        const periods: Period[] = this.getTimeStamps()
        const timeframes = [tradeSession.timeframe]
        const symbol = tradeSession.symbol

        for (const timeframe of timeframes) {
            if (timeframe === undefined) {
                continue;
            }

            const qb1 = this.candleDbService.getQueryBuilder()
            const count = await qb1
                .select("COUNT(mts)", "count")
                .where("timeframe = :timeframe", { timeframe: tradeSession.timeframe })
                .andWhere("symbol = :symbol", { symbol: tradeSession.symbol })
                .getRawOne()

            if(count.count > 100) {
                continue
            }

            const candleWidthVal = candleWidth(timeframe)

            for (const period of periods) {
                const pathParamsData = "trade:" + timeframe + ":" + symbol;
                console.log(period.year + " " + period.startmonth)

                const startTime = period.smts
                const endTime = period.emts

                let queryParams = 'limit=10000&sort=1&start=' + startTime + '&end=' + endTime

                if (period.current) {
                    queryParams = 'limit=10000&sort=1&start=' + startTime
                }

                const data = await this.processRestData(pathParamsData, candleWidthVal, queryParams)
                // const data = []

                for (const candleData of data) {
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

            }
        }
    }

    async processRestData(pathParamsData: string, candleWidthVal: number, queryParams: string): Promise<number[]> {
        const data = await this.getRestData(pathParamsData, queryParams);
        if (data[0] == 'error') {
            throw console.error("Candle Error!");
            
        }
        return padCandles(data, candleWidthVal)
    }

    getTimeStamps(): Period[] {
        dayjs.extend(utc)
        const currentDate = new Date();
        const currentYear = currentDate.getUTCFullYear();
        const currentMonth = currentDate.getUTCMonth();

        const date1 = dayjs.utc('2021')
        const date2 = dayjs.utc(currentDate)

        const diff = date2.diff(date1, 'month')

        const periods = []
        for (let m = 0; m <= diff; m++) {
            const next = dayjs.utc(date1).add(m, 'month').startOf('month')
            periods.push({
                smts: next.valueOf(),
                emts: dayjs.utc(next).endOf('month').valueOf(),
                year: next.year(),
                startmonth: next.month(),
                current: next.month() == currentMonth && next.year() == currentYear ? true : false,
            })
        }
        return periods;
    }

    async getRestData(pathParamsData: string, queryParams: string): Promise<any> {
        // wait 600ms delay so we don't hit the rate limit
        await new Promise(r => setTimeout(r, 600));

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
