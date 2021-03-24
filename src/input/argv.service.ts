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
            port: {
                alias: 'p',
                default: 3000,
                demandOption: true,
                description: 'Port ex. 3000'
            }
          }).argv;

            console.log(this.argv)
    }

    getArguments(): any {
        return this.argv
    }

    getSymbol(): string {
        if(process.env.symbol) {
            return process.env.symbol
        }
        return this.argv.symbol
    }

    getPort(): number {
        if(process.env.port) {
            return parseInt(process.env.port, 10)
        }
        return this.argv.port
    }
}