import { Injectable } from '@nestjs/common';
import { SocketsService } from './bfx.sockets.service';
import { BackTestDataSource } from '../backtest/btest.datasource.service'
import { ApiKeyService } from "../input/apikey.service";
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { HistCandlesService } from '../candles/hist/histcandles.service';
import { CandleDbService } from 'src/candles/candle.db.service';


@Injectable()
export class SocketFactory {

    constructor(
        private readonly apiKeyService: ApiKeyService,
        @InjectQueue('bot') private readonly botQueue: Queue,
        private readonly histCandles: HistCandlesService,
        private readonly candleDbService: CandleDbService
        ) { }

    public async getService(exchange: string): Promise<SocketsService|BackTestDataSource> {
        if(exchange == 'bfx') {
            return new SocketsService(this.apiKeyService, this.botQueue);
        }

        if(exchange == 'backtest') {
            return new BackTestDataSource(this.botQueue, this.histCandles, this.candleDbService);
        }
    }
}