import { Injectable, Inject, Logger, LoggerService } from '@nestjs/common'
import { RestService } from './rest.service'
import { TradeService } from './trade.service'
import { ArgvService } from 'src/input/argv.service'
import { TradeSessionBLService } from 'src/tradesession/tradesession.bl.service'

@Injectable()
export class ReconnectService {

    constructor(
        private restService: RestService,
        private tradeService: TradeService,
        private argvService: ArgvService,
        @Inject(Logger) private readonly logger: LoggerService,
        private readonly tradeSessionBLService: TradeSessionBLService) {
    }

    async reConnect(): Promise<any> {
        // prevent signals while we are setting up the state
        this.tradeService.setStarting(true)
        const configSymbol = this.argvService.getSymbol()

        const positions = await this.restService.fetchActivePositions()
        this.logger.log(positions)

        if (!positions) {
            this.tradeService.setStarting(false)
            return
        }

        for (const pos of positions) {
            if (pos[1] === 'ACTIVE' && (pos[0] == configSymbol || pos[0] == 'tTESTBTC:TESTUSD')) {
                this.logger.log(pos)
                // Last buy order from history

                const posId = pos[11]
                const tradeSession = await this.tradeSessionBLService.findLastActiveBySymbolandId(configSymbol, posId)

                this.tradeService.restartTrade(tradeSession)
            }
        }

        this.tradeService.setStarting(false)
    }

    
}
