import { Injectable, Inject, Logger, LoggerService } from '@nestjs/common'
import { RestService } from './rest.service'
import { TradeService } from './trade.service'
import { Key } from '../interfaces/key.model'
import { Order } from '../interfaces/order.model'

@Injectable()
export class ReconnectService {

    private setManualPosition = false

    constructor(
        private restService: RestService,
        private tradeService: TradeService,
        @Inject(Logger) private readonly logger: LoggerService) {
    }

    async reConnect(): Promise<any> {
        // prevent signals while we are setting up the state
        this.tradeService.setStarting(true)

        const positions = await this.restService.fetchActivePositions()
        this.logger.log(positions)

        for (const pos of positions) {
            if (pos[1] === 'ACTIVE' && (pos[0] == 'tBTCUSD' || pos[0] == 'tTESTBTC:TESTUSD')) {

                // Last buy order from history
                const lastOrderId = pos[19]['order_id']
                const lastHistBuyOrders = await this.restService.fetchOrders(pos[0], { id: [lastOrderId] }, true)
                
                this.logger.log(lastHistBuyOrders)
                
                if (lastHistBuyOrders) {
                    if(typeof lastHistBuyOrders[0][31] === 'object' && lastHistBuyOrders[0][31] !== null && lastHistBuyOrders[0][31].hasOwnProperty('id')) {
                    const lastHistBuyOrder = this.formatOrder(lastHistBuyOrders[0], true)
                    this.logger.log(lastHistBuyOrder, "Last History Buy Order")


                    let key: Key = lastHistBuyOrder['meta']['key']
                    let restartOrder = lastHistBuyOrder

                    // Active orders
                    const activeOrders = await this.restService.fetchOrders(pos[0])

                    if (activeOrders && activeOrders.length > 0) {
                        this.logger.log(activeOrders, "Active Orders")

                        for (const activeOrder of activeOrders) {
                            // we do this once we connect from order snapshot 
                            // @see 
                            // if (activeOrder[8] == 'TRAILING STOP') {
                            //    this.tradeService.setTrailingOrderSent(true)
                            // }
                            if (activeOrder[8] == 'LIMIT') {
                                const lastActiveBuyOrder = this.formatOrder(activeOrder, false)
                                this.logger.log(lastActiveBuyOrder, 'last active LIMIT order')

                                key = lastActiveBuyOrder['meta']['key']
                                restartOrder = lastActiveBuyOrder
                            }
                        }
                    }

                    this.logger.log(restartOrder, 'restart order')
                    this.tradeService.restartTrade(key, restartOrder)
                    } else { 
                        // the last order was not created by this bot
                        this.setManualPosition = true
                    }
                }
            }
        }

        if(this.setManualPosition) {
            this.tradeService.setManualPosition(true)
        }

        this.tradeService.setStarting(false)
    }

    // TODO: try using order convert form bfx libarary here see what happens
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
                tradeExecuted: tradeExecuted,
                tradeTimestamp: apiOrder[5]
            }
        }

        return order;
    }
}
