import { Injectable } from '@nestjs/common'
import fetch from 'node-fetch'
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Order } from '../../interfaces/order.model'
import { Period } from '../../interfaces/period.model'
import { ObjectMeta } from '../../interfaces/objectmeta.model'
import { convertArrayToCSV } from 'convert-array-to-csv'
import * as fse from 'fs-extra'
import { padCandles } from 'bfx-api-node-util'
import { candleWidth } from 'bfx-hf-util'


@Injectable()
export class HistCandlesService {

    private cryptoXlsDir = path.join(os.homedir(), 'Documents', 'CryptoXLS')

    async prepareHistData(orders: Order[]): Promise<any> {
        const periods: Period[] = this.getTimeStamps()
        const timeframes = this.getTimeFrames(orders)
        const passedTimeFrames = []
        const symbol = orders[101].symbol;

        for (const timeframe of timeframes) {
            if (timeframe === undefined) {
                continue;
            }

            const candleWidthVal = candleWidth(timeframe) 
            // check if we already delt with the same timeframe in this session 
            if (passedTimeFrames.includes(timeframe)) {
                continue;
            }
            passedTimeFrames.push(timeframe)
            for (const period of periods) {
                const pathParamsData = "trade:" + timeframe + ":" + symbol;

                const startTime = period.smts
                const endTime = period.emts

                const filePath = path.join(this.cryptoXlsDir, symbol, 'hist', timeframe,
                    period.year + '-' + period.startmonth + '.csv');

                // Check if the file exists in the current directory, and if it is writable.
                if (fs.existsSync(filePath)) {
                    continue;
                }

                const data = await this.getRestData(pathParamsData, startTime, endTime);
                const padedCandles = padCandles(data, candleWidthVal)
                // remove last candle because it's from the next month
                padedCandles.pop()

                // wait 600ms delay so we don't hit the rate limit
                await new Promise(r => setTimeout(r, 600));

                const header = ["mts", "open", "close", "high", "low", "volume"]
                const csv = convertArrayToCSV(padedCandles, {
                    header,
                    separator: ','
                });

                // write CSV to a file

                fse.outputFile(filePath, csv, err => {
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

    getTimeFrames(orders: Order[]): string[] {
        const timeframes: string[] = [];
        for (const order of orders) {
            if (order === undefined) {
                continue;
            }
            const orderMeta: ObjectMeta = order.meta;
            timeframes.push(orderMeta.timeframe)
        }

        timeframes.push("1d")
        return timeframes
    }

    getTimeStamps(): Period[] {

        const currentDate = new Date();
        const currentYear = currentDate.getUTCFullYear();
        const currentMonth = currentDate.getUTCMonth();

        let year = currentYear;

        let startMonth = currentMonth - 1;
        let endMonth = currentMonth;

        const periods = [];

        do {
            do {
                const startTime = new Date(Date.UTC(year, startMonth, 1));
                const startTimestamp = startTime.getTime();

                let endTime: Date;

                // if it's the last month of the year
                if (startMonth == 11) {
                    endTime = new Date(Date.UTC(year + 1, 0, 1));
                    endMonth = 12;
                } else {
                    endTime = new Date(Date.UTC(year, endMonth, 1));
                }

                const endTimestamp = endTime.getTime();

                const obj = {
                    smts: startTimestamp,
                    emts: endTimestamp,
                    year: year,
                    startmonth: startMonth,
                    endmonth: endMonth
                }

                periods.push(obj);

                startMonth = startMonth - 1;
                endMonth = endMonth - 1;

            } while (startMonth >= 0);

            year = year - 1;
            startMonth = 11;
            endMonth = 11; // ovo je 12 mjesec

        } while (year > 2015);

        return periods;
    }

    async getRestData(pathParamsData: string, startTime: number, endTime: number): Promise<any> {
        const url = 'https://api-pub.bitfinex.com/v2'

        const pathParams = 'candles/' + pathParamsData + '/hist' // Change these based on relevant path params. /last for last candle
        const queryParams = 'limit=10000&sort=1&start=' + startTime + '&end=' + endTime // Change these based on relevant query params

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
