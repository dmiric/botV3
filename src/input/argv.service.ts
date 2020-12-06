import { Injectable } from '@nestjs/common';
import * as yargs from 'yargs';

@Injectable()
export class ArgvService {

    private argv;

    constructor() {
        this.argv = yargs.options({
            symbol: {
                alias: 's',
                default: 'tBTCUSD',
                demandOption: true,
                description: 'Type in the symbol ex. tBTCUSD'
            },
            file: {
                alias: 'f',
                default: '1.xls',
                demandOption: true,
                description: 'Excel file name. Ex. test.xlsx'
            },
            indicatorOffset: {
                alias: 'io',
                default: 200,
                description: 'Inicator offset ex. 200'
            }
          })
            .argv;

            console.log(this.argv)
    }

    getArguments(): any {
        return this.argv
    }

    getSymbol(): string {
        return this.argv.symbol
    }

    getFile(): string {
        return this.argv.file
    }

    getIndicatorOffset(): number {
        return this.argv.indicatorOffset
    }
}
