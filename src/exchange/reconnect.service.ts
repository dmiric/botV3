import { Injectable, Inject, Logger, LoggerService } from '@nestjs/common'
import { RestService } from './rest.service'
import { TradeService } from './trade.service'
import { TradeSessionBLService } from '../tradesession/tradesession.bl.service'
import { ConfigService } from '../config/config.service'

@Injectable()
export class ReconnectService {

    constructor(
        private restService: RestService,
        private tradeService: TradeService,
        private config: ConfigService,
        @Inject(Logger) private readonly logger: LoggerService,
        private readonly tradeSessionBLService: TradeSessionBLService) {
    }

    async reConnect(): Promise<any> {
        // prevent signals while we are setting up the state
        this.tradeService.setStarting(true)
        const tradeSession = await this.tradeSessionBLService.findLastActive()
        if (!tradeSession) {
            this.tradeService.setStarting(false)
            return
        }

        if(tradeSession.exchange == 'backtest') {
            this.tradeService.setStarting(false)
            return
        }
        await this.tradeService.restartTrade(tradeSession)
        this.tradeService.setStarting(false)
    }


}
