import { Injectable, Inject, Logger, LoggerService } from '@nestjs/common'
import { StrategyOneService } from './strategies/strategy.one.service'
import { StrategyTwoService } from './strategies/strategy.two.service'

import { ParseCandlesService } from '../candles/parsecandles.service'

import { BencBehaviourService } from '../behaviour/bencbehaviour.service'
import { BFXReqService } from './bfxreq.service'
import { RestService } from './rest.service';
import { BuyOrderBLService } from '../order/buyorder.bl.service';
import { SellOrderBLService } from '../order/sellorder.bl.service'
import { SocketsService } from './bfx.sockets.service'
import { BackTestDataSource } from '../backtest/btest.datasource.service'
import { BalanceService } from 'src/balance/balance.service'
import { WalletService } from 'src/wallet/wallet.service'


@Injectable()
export class StrategyFactory {

    constructor(
        private readonly parseCandlesService: ParseCandlesService,
        private readonly behaviorService: BencBehaviourService,
        private readonly bfxReqService: BFXReqService,
        private readonly restService: RestService,
        @Inject(Logger) private readonly logger: LoggerService,
        private readonly buyOrderBLService: BuyOrderBLService,
        private readonly sellOrderBLService: SellOrderBLService,
        private readonly balanceService: BalanceService,
        private readonly walletService: WalletService
    ) { }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public async getService(strategy: string, source: SocketsService|BackTestDataSource): Promise<SocketsService|BackTestDataSource>{
        let service
        const socketsService: any = source
        switch (strategy) {
            case 'one':               
                service = new StrategyOneService(
                    this.parseCandlesService,
                    this.behaviorService,
                    this.bfxReqService,
                    this.restService,
                    this.logger,
                    this.buyOrderBLService,
                    this.sellOrderBLService,
                    (socketsService as SocketsService));
                break;
            case 'two':
                service = new StrategyTwoService(
                    this.parseCandlesService,
                    this.restService,
                    this.bfxReqService,
                    this.logger,
                    this.buyOrderBLService,
                    this.sellOrderBLService,
                    (socketsService as SocketsService),
                    this.balanceService,
                    this.walletService);
                break;
        }

        return service
    }
}