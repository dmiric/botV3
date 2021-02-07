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
                this.logger.log(pos)
                // Last buy order from history
                const lastOrderId = pos[19]['order_id']
                const lastHistBuyOrders = await this.restService.fetchOrders(pos[0], {id: [lastOrderId]}, true)

                // take datetime when position was made and look back only to that datetime
                // find last order made by bot - check if order.meta has id

                this.logger.log(lastHistBuyOrders)

                if (lastHistBuyOrders && lastHistBuyOrders.length > 0) {
                    if (typeof lastHistBuyOrders[0][31] === 'object' && lastHistBuyOrders[0][31] !== null) {
                        const potentialLastHistBuyOrder = this.formatOrder(lastHistBuyOrders[0], true)
                        let lastHistBuyOrder = potentialLastHistBuyOrder
                        this.logger.log(potentialLastHistBuyOrder, "Potential Last History Buy Order")
                        
                        // if we have one of the custom orders as last order that affected the position
                        // look for last bot made order
                        if(!potentialLastHistBuyOrder.meta.id && potentialLastHistBuyOrder.meta.type == 'custom') {
                            const lastHistBuyOrders = await this.restService.fetchOrders(pos[0], {limit: 100}, true)
                            for(const order of lastHistBuyOrders) {
                                if(order[31] === null) {
                                    continue
                                }
                                if(order[31].hasOwnProperty('id') && order[31]['key']['id'] == potentialLastHistBuyOrder.meta.key.id) {
                                    this.logger.log(order, 'Last History Buy Order')
                                    lastHistBuyOrder = this.formatOrder(order, true)
                                    break
                                }
                            }
                        }

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
                                if (activeOrder[8] == 'LIMIT' && activeOrder[31] === null) {
                                    continue
                                }

                                if (activeOrder[31]['key'] !== null && activeOrder[31]['type'] === 'bot') {
                                    const lastActiveBuyOrder = this.formatOrder(activeOrder, false)
                                    this.logger.log(lastActiveBuyOrder, 'last active LIMIT order')

                                    key = lastActiveBuyOrder['meta']['key']
                                    restartOrder = lastActiveBuyOrder
                                }
                            }
                        }

                        this.logger.log(restartOrder, 'restart order')
                        this.tradeService.restartTrade(key, restartOrder)
                    }
                } else {
                    // the last order was not created by this bot
                    this.setManualPosition = true
                }
            }
        }

        if (this.setManualPosition) {
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
            price: apiOrder[16],
            meta: {
                id: apiOrder[31]['id'],
                key: apiOrder[31]['key'],
                aff_code: apiOrder['aff_code'],
                tradeExecuted: tradeExecuted,
                tradeTimestamp: apiOrder[5],
                sentToEx: true,
                type: apiOrder[31]['type']
            }
        }

        return order;
    }
}
