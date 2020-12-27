import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import xlsx from 'node-xlsx';
import { Order } from '../interfaces/order.model'
import { ArgvService } from './argv.service';


@Injectable()
export class ReadxlsService {

    private dates = [];
    private rawXlsData = [];
    private cryptoXlsDir = path.join(os.homedir(), 'Documents', 'CryptoXLS')

    constructor(private argvService: ArgvService) { }

    fileAccess(filePath: string): boolean {
        fs.access(filePath, fs.constants.F_OK, function (err) {
            if (err) {
                throw new Error("Can not access XLS file:" + err);
            }
        });

        return true;
    }

    getTestTimePeriods(): number[][] {
        const fileName = 'test-cases.xls'
        const filePath = path.join(this.cryptoXlsDir, fileName)

        if (this.fileAccess(filePath)) {
            this.rawXlsData = xlsx.parse(fs.readFileSync(filePath));
            const periods: number[][] = [];

            for (let i = 1; i < 1000; i++) {
                if(this.rawXlsData[0].data[i] == 'undefined' || this.rawXlsData[0].data[i] == 'undefined') {
                    break;
                }
                const start = this.rawXlsData[0].data[i][2]
                const end = this.rawXlsData[0].data[i][3]

                periods.push([this.xl2timestamp(start), this.xl2timestamp(end)])
            }
            return periods;
        }
    }

    readOrders(): Order[] {

        const symbol = this.argvService.getSymbol()
        const fileName = this.argvService.getFile()

        const filePath = path.join(this.cryptoXlsDir, symbol, fileName)

        if (this.fileAccess(filePath)) {

            this.rawXlsData = xlsx.parse(fs.readFileSync(filePath));
            const orders: Order[] = []

            for (let i = 8; i < 29; i++) {
                const amount = this.rawXlsData[0].data[i][18]
                const timeframe = this.rawXlsData[0].data[i][19]
                const orderNr = this.rawXlsData[0].data[i][20] + 100
                const safeDistance = this.rawXlsData[0].data[i][21] / 100
                const target = this.rawXlsData[0].data[i][22] / 100


                orders[orderNr] = {
                    cid: orderNr, // `${orderNr}${6}`,
                    type: "LIMIT",
                    symbol: symbol,
                    amount: amount,
                    meta: {
                        timeframe: timeframe,
                        safeDistance: safeDistance,
                        target: target
                    }
                }
            }

            this.dates.push(this.xl2timestamp(this.rawXlsData[0].data[19][4]))
            this.dates.push(this.xl2timestamp(this.rawXlsData[0].data[19][5]))

            return orders;
        }

    }

    getDates(): number[] {
        return this.dates
    }

    xl2timestamp(xlsDate: number): number {
        return ((xlsDate - 25569) * 86400) * 1000
    }

}
