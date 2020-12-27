import { Injectable } from '@nestjs/common';
const xlsx = require('json-as-xlsx');
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as fse from 'fs-extra'
import { Key } from '../interfaces/key.model';
import { ArgvService } from 'src/input/argv.service';
import { KeyService } from 'src/candles/key.service';

@Injectable()
export class LogService {

    private log = [];
    private shortLog = [];
    private currentItem = []
    private subTotalProfit = 0;
    private cryptoXlsDir = path.join(os.homedir(), 'Documents', 'CryptoXLS')

    constructor(private argvService: ArgvService) { }

    newLine(key: Key): void {
        // if current item is defined
        if (this.currentItem && this.currentItem[key.id]) {
            this.currentItem[key.id]['key'] = key.id
            this.log.push(this.currentItem[key.id])
            
            if(this.currentItem[key.id].short == 1) {
                this.shortLog.push(this.currentItem[key.id])
            }
        }
        this.currentItem[key.id] = this.item()

    }

    setData(key: Key, data: string | number[], keys: string[], short = 1): void {
        for (const k of keys) {
            const index = keys.indexOf(k)
            this.currentItem[key.id][k] = data[index]
        }

        this.currentItem[key.id].short = short
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    oneLineLog(key: Key, shortLog: any): void {
        console.log('----------------------------------------------------------------------------------')
        console.log("Results from: " + new Date(key.logDates[0]).toLocaleString()  + ' to ' + new Date(key.logDates[1]).toLocaleString() )
        if(shortLog.length < 2) {
            console.log("There were no buy or sell order in this period.")
            console.log('----------------------------------------------------------------------------------')
            return;
        }
        const buyNumberCount = shortLog.reduce( (item, o) => (item[o.bob_cid] = (item[o.bob_cid] || 0)+1, item), {} );
        const profit = this.sum(shortLog, 'profit')
        const fees = this.sum(shortLog,'so_fee') + this.sum(shortLog, 'bob_fee')
        const totalProfit = profit - fees
        const sells = this.max(shortLog, 'c_sells')
        const lastBuyOrder = this.last(shortLog, 'bob_cid')
        const elapsedDays = (key.logDates[1] - key.logDates[0]) / (1000 * 3600 * 24);
        const balance = this.last(shortLog, 'balance')
        const monthlyProfitPercentage = this.lastSaleBalance(shortLog, key)
        console.log(JSON.stringify(buyNumberCount))
        console.log("Number of sells: " + sells)
        console.log("Profit: " + totalProfit.toFixed(2))
        console.log("Last buy order: " + lastBuyOrder)
        console.log("Start price: " + shortLog[1]['close'])
        console.log("End price: " + shortLog[shortLog.length - 1]['close'])
        console.log("Balance: " + balance.toFixed(2) )
        console.log("Days: " + elapsedDays)
        console.log("Monthly profit: " + monthlyProfitPercentage.toFixed(2) + "%")
        console.log('----------------------------------------------------------------------------------')
        this.subTotalProfit = this.subTotalProfit + totalProfit
        console.log("Profit Subtotal:" + this.subTotalProfit.toFixed(2))
    }

    sum(arr: any, key: string): number {
        return arr.reduce( (prev, current) => { 
            return prev + current[key] 
            }, 0);
    }

    max(arr, key: string): number {
        return arr.reduce( (prev, current) => { 
            return typeof(current[key]) === 'number' && current[key] > prev ? current[key] : prev 
            }, 0);
    }

    last(arr, key: string): number {
        for (let i = 1; i < arr.length; i++) {
            if(typeof(arr[arr.length - i][key]) == 'number') {
                return arr[arr.length - i][key]
            }
        }
    }

    lastKey(arr, key: string): number {
        for (let i = 1; i < arr.length; i++) {
            if(typeof(arr[arr.length - i][key]) == 'number' && arr[arr.length - i][key] > 0) {
                return arr.length - i
            }
        }
    }

    lastSaleBalance(arr, key: Key): number {
        const lastSellOrderKey = this.lastKey(arr, 'profit')
        const elapsedDays = (arr[lastSellOrderKey]['mts'] - key.logDates[0]) / (1000 * 3600 * 24);
        const thirthyDayProfit = ((arr[lastSellOrderKey]['balance'] - key.startBalance) / elapsedDays) * 30
        return thirthyDayProfit / key.startBalance * 100
    }

    item() {
        const item = {
            mts: 0,
            datetime: "",
            open: 0,
            close: 0,
            high: 0,
            low: 0,
            bo_cid: "",
            bo_price: "",
            timeframe: "",
            so_cid: "",
            so_price: "",
            c_sells: "",
            c_buys: "",
            total_amount: "",
            total_value: "",
            bob_price: "",
            bob_cid: "",
            bob_count: "",
            candle_set_start: "",
            short: 0,
            profit: 0,
            so_fee: 0,
            bob_fee: 0,
            indicator: '',
            balance: ''
        }

        return item
    }

    showLog() {
        console.table(this.log)
    }

    writeXls(key: Key): void {
        const shortLog = []
        for (const line of this.shortLog) {
            if(line.key == key.id) {
                shortLog.push(line)
            }
        } 

        const startDate = new Date(key.logDates[0])
        const startYear = startDate.getUTCFullYear()
        const startMonth = startDate.getUTCMonth()
        
        const endDate = new Date(key.logDates[1])
        const endYear = endDate.getUTCFullYear()
        const endMonth = endDate.getUTCMonth()

        const xlsFileName = this.argvService.getFile().split('.')

        let filePath = path.join(this.cryptoXlsDir, key.symbol, 'test', xlsFileName[0],
            startYear + '-' + startMonth + '_' + endYear + '-' + endMonth);

        // Check if the file exists in the current directory, and if it is writable.
        //filePath = this.fileExists(filePath)
        filePath = filePath + '-' + this.getRandomNum(0, 999999) + '.xlsx'

        const settings = {
            sheetName: 'Sheet 1', // The name of the sheet
            extraLength: 1, // A bigger number means that columns should be wider
            writeOptions: {} // Style options from https://github.com/SheetJS/sheetjs#writing-options
        }

        const mapXlsx = this.mapXlsx()

        const xls = xlsx(mapXlsx, shortLog, settings, false)

        fse.ensureFileSync(filePath)
        // open the file in writing mode, adding a callback function where we do the actual writing
        fs.open(filePath, 'w', function (err, fd) {
            if (err) {
                throw 'could not open file: ' + err;
            }

            // write the contents of the buffer, from position 0 to the end, to the file descriptor returned in opening our file
            fs.write(fd, xls, 0, xls.length, null, function (err) {
                if (err) throw 'error writing file: ' + err;
                fs.close(fd, function () {
                    //console.log('wrote the file successfully');
                });
            });
        });

        /*
        const log = []
        for (const line of this.log) {
            if(line.key == key.id) {
                log.push(line)
            }
        }
        */

        this.oneLineLog(key, shortLog)

    }

    mapXlsx() {
        const cols = [
            { label: "mts", value: "mts" },
            { label: "datetime", value: "datetime" },
            { label: "open", value: "open" },
            { label: "close", value: "close" },
            { label: "high", value: "high" },
            { label: "low", value: "low" },
            //{ label: "indicator price", value: "indicator" },
            { label: "Tf", value: "timeframe" },
            //{ label: "Start candle mts", value: "candle_set_start" },
            { label: "Buy order ID", value: "bo_cid" },            
            { label: "Buy order price", value: "bo_price" },
            { label: "Buy order count", value: "c_buys" },
            { label: "Bo bought ID", value: "bob_cid" },
            { label: "Bo bought price", value: "bob_price" },
            { label: "Bo bought count", value: "bob_count" },
            { label: "Bo bought fee", value: "bob_fee" },
            { label: "Sell order ID", value: "so_cid" },
            { label: "Sell order price", value: "so_price" },
            { label: "Sell order fee", value: "so_fee" },
            { label: "Sells", value: "c_sells" },
            { label: "Total amount", value: "total_amount"},
            { label: "Total value", value: "total_value"},
            { label: "Profit", value: "profit"},
            { label: "Balance", value: "balance"}
        ]

        return cols
    }

    getRandomNum(min: number, max: number): number {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1) + min); //The maximum is inclusive and the minimum is inclusive 
      }
}
