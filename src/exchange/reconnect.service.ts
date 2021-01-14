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
        for (const pos of positions) {
            if (pos[1] === 'ACTIVE') {
                const lastOrderId = pos[19]['order_id']
                const lastBuyOrder = await this.restService.fetchOrders(pos[0], { id: [lastOrderId] }, true)
                console.log(lastBuyOrder)
                console.log(lastBuyOrder[0][31]['key'])
                const activeOrder = await this.restService.fetchOrders(pos[0])

                // set ordercycle
                // run trade process
                const key: Key = lastBuyOrder[0][31]['key']
                const order = this.formatOrder(lastBuyOrder[0])

                if (activeOrder.length > 0 && activeOrder[0][8] == 'TRAILING STOP') {
                    this.tradeService.restartTrade(key, order, true)
                } else {
                    this.tradeService.restartTrade(key, order)
                }
                console.log(activeOrder)
            }
        }
        this.logger.log(positions)
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    private formatOrder(apiOrder: any): Order {
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
                tradeExecuted: true
            }
        }

        return order;
    }
}
