import { Injectable } from '@nestjs/common';
import * as xlsx from 'json-as-xlsx'
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as fse from 'fs-extra'
import { Key } from '../interfaces/key.model';
import { ArgvService } from 'src/input/argv.service';

@Injectable()
export class LogService {

    private log = [];
    private shortLog = [];
    private currentItem;
    private cryptoXlsDir = path.join(os.homedir(), 'Documents', 'CryptoXLS')
    private key: Key

    constructor(private argvService: ArgvService) { }

    setKey(key: Key): void {
        if (!this.key) {
            this.key = key
            console.log("set key")
        }
    }

    newLine(): void {
        // if current item is defined
        if (this.currentItem) {
            this.log.push(this.currentItem)
            
            if(this.currentItem.short == 1) {
                this.shortLog.push(this.currentItem)
            }
        }
        const item = this.item()
        this.currentItem = item

    }

    setData(data: string | number[], keys: string[], short = 1): void {
        for (const key of keys) {
            const index = keys.indexOf(key)
            this.currentItem[key] = data[index]
        }

        this.currentItem.short = short
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
            indicator: ''
        }

        return item
    }

    showLog() {
        console.table(this.log)
    }

    writeCVSLog() {
        return
    }

    writeXls(): void {
        const startDate = new Date(this.key.start)
        const startYear = startDate.getUTCFullYear()
        const startMonth = startDate.getUTCMonth()
        
        const endDate = new Date(this.key.end)
        const endYear = endDate.getUTCFullYear()
        const endMonth = endDate.getUTCMonth()

        const xlsFileName = this.argvService.getFile().split('.')

        let filePath = path.join(this.cryptoXlsDir, this.key.symbol, 'test', xlsFileName[0],
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

        const xls = xlsx(mapXlsx, this.log, settings, false)

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
                    console.log('wrote the file successfully');
                });
            });
        });


    }

    mapXlsx() {
        const cols = [
            { label: "mts", value: "mts" },
            { label: "datetime", value: "datetime" },
            { label: "open", value: "open" },
            { label: "close", value: "close" },
            { label: "high", value: "high" },
            { label: "low", value: "low" },
            { label: "indicator price", value: "indicator" },
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
            { label: "Profit", value: "profit"}
        ]

        return cols
    }

    getRandomNum(min: number, max: number): number {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1) + min); //The maximum is inclusive and the minimum is inclusive 
      }
}
