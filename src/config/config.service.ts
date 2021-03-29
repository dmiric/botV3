import { Injectable } from '@nestjs/common';
import * as yargs from 'yargs';
import * as path from 'path';
import * as os from 'os';
import { SqliteConnectionOptions } from 'typeorm/driver/sqlite/SqliteConnectionOptions';

@Injectable()
export class ConfigService {

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
                alias: 'po',
                default: 3000,
                demandOption: true,
                description: 'Port ex. 3000'
            },
            name: {
                alias: 'n',
                default: 'BotV3-no-name',
                demandOption: true,
                description: 'name'
            },
            prod: {
                alias: 'pr',
                default: false,
                demandOption: true,
                description: 'production?'
            }
        }).argv;

        console.log(this.argv)
    }

    getArguments(): any {
        return this.argv
    }

    getSymbol(): string {
        if (process.env.symbol) {
            return process.env.symbol
        }
        return this.argv.symbol
    }

    getPort(): number {
        if (process.env.port) {
            return parseInt(process.env.port, 10)
        }
        return this.argv.port
    }

    getConfigDir(): string {
        if (process.env.name) {
            return path.join(os.homedir(), 'Documents', 'Crypto', process.env.name)
        }
        return path.join(os.homedir(), 'Documents', 'Crypto', this.argv.name)
    }

    getName(): string {
        if (process.env.name) {
            return process.env.name
        }
        return this.argv.name
    }

    isProduction(): boolean {
        return process.env.prod ? true : false
    }

    database(): SqliteConnectionOptions {
        return {
            type: 'sqlite',
            database: this.getConfigDir() + '/botV3.db', // we need this db in /home/user/Documents/Crypto
            entities: [__dirname + '/**/*.entity{.ts,.js}'],
            synchronize: this.isProduction() ? false : true,
        }
    }
}