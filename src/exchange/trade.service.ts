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
import { BencBehaviourService } from '../behaviour/bencbehaviour.service'
import { EmaService } from '../indicators/indicators/ema.service'
import { CandleSocketService } from '../candles/candlesocket.service'
import { Subscription } from 'rxjs'

import { normalClosureMessage } from 'rxjs-websockets';
import { OrderSocketService } from '../orders/ordersocket.service'

@Injectable()
export class TradeService {

    private sold = 0;
    private count = 0;
    private bought = 0;
    private tradeStatus = false;
    private candleSubscription: Subscription;
    private orderSubscription: Subscription;
    private activePosition = [];
    private currentPrice = 0;

    constructor(
        private parseCandlesService: ParseCandlesService,
        private orderCycleService: OrderCycleService,
        private behaviorService: BencBehaviourService,
        private ordersService: OrdersService,
        private candleUtilService: CandleUtilService,
        private keyService: KeyService,
        private logService: LogService,
        private candleSocketService: CandleSocketService,
        private orderSocketService: OrderSocketService
    ) { }

    getStatus(): boolean {
        return this.tradeStatus;
    }

    closePosition(key: Key): void {
        // check if trade is active
        // check if position is positive
        // check if we are in profit over 0.5% - position[7]
        if (this.getStatus() && this.activePosition[2] > 0 && this.activePosition[7] > 0.5) {
            this.orderSocketService.closePosition(key, this.activePosition[2])
        }
    }

    trade(key: Key): void {
        this.tradeStatus = true
        this.orderCycleService.setCurrentTimeFrame(key)

        let candleSet: Candle[] = [];

        this.candleSubscription = this.candleSocketService.messages$.subscribe(
            (message: string) => {
                const trimmed = message.substring(0, 100)
                console.log('candle socket:', trimmed)
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

                    if (data[1].length < 6) {
                        return
                    }

                    this.logService.newLine(key)

                    candleSet = this.parseCandlesService.handleCandleStream(data, key, candleSet)
                    const currentCandle: Candle = candleSet[candleSet.length - 1]

                    // this is a questionable hack to sort out missing candles
                    if (!currentCandle) {
                        console.log(key)
                        throw new Error("Borked!");
                    }

                    // TODO: This price needs to be changed to real (current price???).
                    this.currentPrice = currentCandle.close;

                    if (candleSet && candleSet.length > 1 && !this.orderCycleService.getLastUnFilledBuyOrderId(key)) {
                        const orderId = this.behaviorService.nextOrderIdThatMatchesRules(candleSet, key)
                        //const orderId = 101;
                        // await new Promise(r => setTimeout(r, 500));
                        if (orderId && this.orderSocketService.getSocketReadyState()) {
                            const order = { ...this.ordersService.getOrder(key, orderId, currentCandle.close) }

                            if (order.meta.id == 101) {
                                // send buy order to the api here
                                this.orderSocketService.makeOrder(order)
                                this.orderCycleService.addBuyOrder(key, order, 0)
                                this.logService.setData(key, [++this.bought], ['bob_count'])
                            } else {
                                const buyPrice = this.behaviorService.getBuyOrderPrice(candleSet)
                                order['price'] = buyPrice
                                this.orderSocketService.makeOrder(order)
                            }

                            candleSet = []
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

        this.orderSubscription = this.orderSocketService.messages$.subscribe(
            (message: string) => {
                const trimmed = message.substring(0, 66230)
                console.log('order socket:', trimmed)
                // respond to server
                const data = JSON.parse(message)

                if (data.event === "info") {

                    // if we just connected to the stream we find the last order we want to start from
                    // and we send a message to start the stream
                    this.orderSocketService.auth()
                } else {
                    // hb: hearth beat
                    if (data.event || data[1] == 'hb') {
                        return;
                    }
                    // ws: wallet snapshot
                    if (data[1] == 'ws') {
                        this.orderSocketService.setReadyState(true)
                    }

                    // wu: wallet update
                    if (data[1] == 'wu') {

                    }

                    // ps: position snapshot
                    if (data[1] == 'ps') {

                    }

                    // pu: position update
                    if (data[1] == 'pu') {
                        if (data[2][0] !== key.symbol) {
                            return
                        }

                        if (data[2][1] == 'ACTIVE') {
                            this.activePosition = data[2]
                        }

                        // if profit reached X% set tracking order
                        if (key.hasOwnProperty('trailingProfit') && key.hasOwnProperty('trailingDistance')) {
                            if (data[2][1] !== 'ACTIVE') {
                                return
                            }

                            if (data[2][7] > key.trailingProfit) {
                                // createTrackingOrder here
                                const priceTrailing = this.currentPrice * (key.trailingDistance / 100)
                                this.orderSocketService.makeTrailingOrder(key, data[2][2], priceTrailing)
                                this.resetTradeProcess(key)
                            }
                        }
                    }

                    // pc: position closed
                    if (data[1] == 'pc') {
                        this.resetTradeProcess(key)
                    }

                    // te: trade executed
                    if (data[1] == 'te') {
                        // executed trade has to be positive
                        // we are updating buy orders here
                        if (data[2][4] > 0) {
                            this.orderCycleService.updateBuyOrder(key, data[2][11], { price: data[2][5], tradeExecuted: true });
                        }
                    }
                    //message: [0,"te",[563936681,"tTESTBTC:TESTUSD",1609889746511,55970331526,0.0032,33927,"MARKET",33903,-1,null,null,1609889681451]]


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

    resetTradeProcess(key: Key): void {
        // unsub candle stream
        this.candleSubscription.unsubscribe()
        // clean up all the data from the previous cycle
        this.orderCycleService.finishOrderCycle(key)
        // unsub from order stream
        this.orderSubscription.unsubscribe()
        // set process inactive
        this.tradeStatus = false
    }

}
