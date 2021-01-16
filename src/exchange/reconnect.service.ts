import { Injectable, Inject, Logger, LoggerService } from '@nestjs/common'
import { RestService } from './rest.service'
import { TradeService } from './trade.service'
import { Key } from '../interfaces/key.model'
import { Order } from '../interfaces/order.model'

@Injectable()
export class ReconnectService {

    constructor(
        private restService: RestService,
        private tradeService: TradeService,
        @Inject(Logger) private readonly logger: LoggerService) {
    }

    async reConnect(): Promise<any> {
        const positions = await this.restService.fetchActivePositions()
        this.logger.log(positions)

        for (const pos of positions) {
            if (pos[1] === 'ACTIVE' && (pos[0] == 'tBTCUSD' || pos[0] == 'tTESTBTC:TESTUSD')) {

                // Last buy order from history
                const lastOrderId = pos[19]['order_id']
                const lastHistBuyOrders = await this.restService.fetchOrders(pos[0], { id: [lastOrderId] }, true)

                const lastHistBuyOrder = this.formatOrder(lastHistBuyOrders[0], true)
                this.logger.log(lastHistBuyOrder, "Last History Buy Order")

                let key: Key = lastHistBuyOrder[0][31]['key']  

                // Active orders
                const activeOrders = await this.restService.fetchOrders(pos[0])
                this.logger.log(lastHistBuyOrder, "Active Orders")

                if (activeOrders && activeOrders.length > 0) {
                    for(const activeOrder of activeOrders) {
                        if(activeOrder[8] == 'TRAILING STOP') {
                            this.tradeService.setTrailingOrderSent(true)
                        }
                        if(activeOrder[8] == 'LIMIT') {
                            const lastActiveBuyOrder = this.formatOrder(activeOrder, false)
                            key = lastActiveBuyOrder[31]['key']
                            this.tradeService.restartTrade(key, lastActiveBuyOrder)
                            console.log(lastActiveBuyOrder)
                        } else {
                            this.tradeService.restartTrade(key, lastHistBuyOrder)
                        }
                    }
                } 
            }
        }
       
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    private formatOrder(apiOrder: any, tradeExecuted: boolean): Order {
        const order: Order = {
            cid: apiOrder[2],
            symbol: apiOrder[3],
            type: apiOrder[8],
            amount: apiOrder[7],
            price: apiOrder[17],
            meta: {
                id: apiOrder[31]['id'],
                key: apiOrder[31]['key'],
                aff_code: apiOrder['aff_code'],
                tradeExecuted: tradeExecuted
            }
        }

        return order;
    }
}
