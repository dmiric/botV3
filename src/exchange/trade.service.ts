import { Injectable } from '@nestjs/common'
import { Candle } from '../interfaces/candle.model'

import { Key } from '../interfaces/key.model'
import { ParseCandlesService } from '../candles/parsecandles.service'

import { Order } from '../interfaces/order.model'

import { OrdersService } from '../orders/orders.service';
import { KeyService } from '../candles/key.service';
import { OrderCycleService } from '../orders/ordercycle.service';
import { CandleUtilService } from '../candles/candleutil.service';
import { LogService } from '../log/log.service'
import { BencBehaviourService } from 'src/behaviour/bencbehaviour.service'
import { EmaService } from 'src/indicators/indicators/ema.service'
import { CandleSocketService } from 'src/candles/candlesocket.service'
import { Subscription } from 'rxjs'

import { normalClosureMessage } from 'rxjs-websockets';
import { OrderSocketService } from 'src/orders/ordersocket.service'

@Injectable()
export class TradeService {

    private sold = 0;
    private count = 0;
    private bought = 0;

    constructor(
        private parseCandlesService: ParseCandlesService,
        private orderCycleService: OrderCycleService,
        private behaviorService: BencBehaviourService,
        private ordersService: OrdersService,
        private candleUtilService: CandleUtilService,
        private keyService: KeyService,
        private logService: LogService,
        private indicatorService: EmaService,
        private candleSocketService: CandleSocketService,
        private orderSocketService: OrderSocketService
    ) { }

    trade(key: Key): void {
        this.logService.setKey(key)
        const indicatorOffset = key.indicatorOffset

        //if (recruise == 0) {
        this.orderCycleService.setCurrentTimeFrame(key.timeframe)
        this.indicatorService.init(indicatorOffset)
        // }

        let candleSet: Candle[] = [];
        const endDate = key.end
         /*
        const candleSubscription: Subscription = this.candleSocketService.messages$.subscribe(
            (message: string) => {
                const trimmed = message.substring(0, 30)
                console.log('candle socket received message:', trimmed)
                // respond to server
                const data = JSON.parse(message)

                if (data.event === "info") {

                    // if we just connected to the stream we find the last order we want to start from
                    // and we send a message to start the stream
                    this.candleSocketService.setSubscription(key)
                } else {
                    if (data.event) {
                        return;
                    }

                    candleSet = this.parseCandlesService.handleCandleStream(data, key, candleSet)                    
                    if (candleSet && candleSet.length > 1 && !this.orderCycleService.getLastUnFilledBuyOrderId()) {

                        const currentCandle = candleSet[candleSet.length - 1]
                        const orderId = this.behaviorService.nextOrderIdThatMatchesRules(candleSet)
                        // await new Promise(r => setTimeout(r, 500));
                        if (orderId) {
                            const order = { ...this.ordersService.getOrder(orderId) }

                            let buyPrice = this.behaviorService.getBuyOrderPrice(candleSet)

                            if (order.cid == 101) {
                                buyPrice = currentCandle.open
                            }

                            this.orderCycleService.addBuyOrder(order, buyPrice)
                            this.orderCycleService.timeFrameChanged()

                            if (order.cid == 101) {
                                const buyOrder = this.orderCycleService.getBuyOrderByCid(101)
                                this.orderCycleService.buyOrderBought(buyOrder)
                                this.logService.setData([++this.bought], ['bob_count'])
                            }

                            this.logService.setData([
                                candleSet[0].mts,
                                orderId,
                                buyPrice,
                                ++this.count], ['candle_set_start', 'bo_cid', 'bo_price', 'c_buys'])

                            candleSet = []
                            if (this.orderCycleService.timeFrameChanged()) {
                                const newKey: Key = {
                                    trade: "trade",
                                    timeframe: this.orderCycleService.getLastOrderTimeFrame(), // should be first order timeframe
                                    symbol: order.symbol,
                                    indicatorOffset: indicatorOffset,
                                    start: key.start,
                                    end: key.end
                                }

                                this.indicatorService.init(indicatorOffset)
                                this.candleSocketService.setSubscription(newKey)
                            }
                        }
                    }

                }
            },
            (error: Error) => {
                const { message } = error
                if (message === normalClosureMessage) {
                    console.log('server closed the CANDLE websocket connection normally')
                } else {
                    console.log('CANDLE socket was disconnected due to error:', message)
                }
            },
            () => {
                // The clean termination only happens in response to the last
                // subscription to the observable being unsubscribed, any
                //other closure is considered an error.
                console.log('the CANDLE socket connection was closed in response to the user')
            },
        )

  */
        const orderSubscription: Subscription = this.orderSocketService.messages$.subscribe(
            (message: string) => {
                const trimmed = message.substring(0, 130)
                console.log('order socket received message:', trimmed)
                // respond to server
                const data = JSON.parse(message)

                if (data.event === "info") {

                    // if we just connected to the stream we find the last order we want to start from
                    // and we send a message to start the stream
                    this.orderSocketService.auth()
                } else {
                    if (data.event) {
                        return;
                    }
                    
                    // u ovu jupu dodje kod

                }
            },
            (error: Error) => {
                const { message } = error
                if (message === normalClosureMessage) {
                    console.log('server closed the ORDER websocket connection normally')
                } else {
                    console.log('ORDER socket was disconnected due to error:', message)
                }
            },
            () => {
                // The clean termination only happens in response to the last
                // subscription to the observable being unsubscribed, any
                //other closure is considered an error.
                console.log('the ORDER socket connection was closed in response to the user')
            },
        )
    }

}
