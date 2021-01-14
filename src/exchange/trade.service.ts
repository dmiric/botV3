import { Injectable, Inject, Logger, LoggerService } from '@nestjs/common'
import { Candle } from '../interfaces/candle.model'

import { Key } from '../interfaces/key.model'
import { ParseCandlesService } from '../candles/parsecandles.service'

import { OrdersService } from '../orders/orders.service';
import { KeyService } from '../candles/key.service';
import { OrderCycleService } from '../orders/ordercycle.service';
import { CandleUtilService } from '../candles/candleutil.service';
import { BencBehaviourService } from '../behaviour/bencbehaviour.service'
import { CandleSocketService } from '../candles/candlesocket.service'
import { Subscription } from 'rxjs'
import { Order } from '../interfaces/order.model'
import { normalClosureMessage } from 'rxjs-websockets';
import { OrderSocketService } from '../orders/ordersocket.service'

@Injectable()
export class TradeService {

    private tradeStatus = false;
    private candleSubscription: Subscription;
    private orderSubscription: Subscription;
    private activePosition = [];
    private currentPrice = 0;
    private lastSignal: Key;
    private lastSignalTime;
    private trailingOrderSent = false;
    private trailingStopOrderId = 0;

    constructor(
        private parseCandlesService: ParseCandlesService,
        private orderCycleService: OrderCycleService,
        private behaviorService: BencBehaviourService,
        private ordersService: OrdersService,
        private candleUtilService: CandleUtilService,
        private keyService: KeyService,
        private candleSocketService: CandleSocketService,
        private orderSocketService: OrderSocketService,
        @Inject(Logger) private readonly logger: LoggerService
    ) { }

    getStatusInfo() {
        let status = {}
        status = this.orderCycleService.getStatus()
        status['tradeStatus'] = this.tradeStatus
        status['activePosition'] = this.activePosition
        status['lastSignal'] = this.lastSignal
        status['lastSignalTime'] = this.lastSignalTime
        return status;
    }

    getStatus(): boolean {
        return this.tradeStatus;
    }

    setLastSignal(key: Key): void {
        this.lastSignal = key;
        const d = new Date();
        this.lastSignalTime = d.toString();

        this.logger.log(this.lastSignal, "signal")
        this.logger.log(this.lastSignalTime, "signal")
    }

    closePosition(key: Key): void {
        this.setLastSignal(key)
        // check if trade is active
        // check if position is positive
        // check if we are in profit over 0.5% - position[7]
        if(this.trailingOrderSent && this.trailingStopOrderId > 0) {
            this.orderSocketService.cancelOrder(this.trailingStopOrderId)
        }

        if (this.getStatus() && this.activePosition[2] > 0 && this.activePosition[7] > 0.5) {
            this.orderSocketService.closePosition(key, this.activePosition[2])
        }
    }

    restartTrade(key: Key, lastBuyOrder: Order, trailing = false ): void {
        // set lastBuyOrder in OrderCycle
        this.orderCycleService.addBuyOrder(key, lastBuyOrder, lastBuyOrder.price)
        // set trailing order if present
        this.trailingOrderSent = trailing
        // use key to start the trade again
        this.trade(key)
    }

    trade(key: Key): void {
        this.setLastSignal(key)

        this.tradeStatus = true
        this.orderCycleService.setCurrentTimeFrame(key)

        this.orderSubscription = this.orderSocketService.messages$.subscribe(
            (message: string) => {                
                // respond to server
                const data = JSON.parse(message)
                this.logger.log(data, "order socket")

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
                        this.candleStream(key)                        
                    }

                    // wu: wallet update
                    if (data[1] == 'wu') {
                        // make orders that are not executed
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
                            if (data[2][1] !== 'ACTIVE' || this.trailingOrderSent) {
                                return
                            }

                            if (data[2][7] > key.trailingProfit) {
                                const priceTrailing = this.currentPrice * (key.trailingDistance / 100)
                                this.orderSocketService.makeTrailingOrder(key, data[2][2], priceTrailing)
                                this.trailingOrderSent = true
                                //this.resetTradeProcess(key)
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

                    // os: order snapshot
                    if (data[1] == 'os') {
                        for(const order of data[2]) {
                            if(order[8] == 'TRAILING STOP') {
                                this.trailingStopOrderId = order[0]
                            }
                        }
                    }

                    // oc: order cancel
                    if(data[1] == 'oc') {
                        if(data[2][0] == this.trailingStopOrderId) {
                            this.trailingOrderSent = false;
                            this.trailingStopOrderId = 0;
                        }
                    }
                }
            },
            (error: Error) => {
                const { message } = error
                if (message === normalClosureMessage) {
                    this.logger.log("server closed the ORDER socket connection normally", "order socket")
                } else {
                    this.logger.log('ORDER socket was disconnected due to error: ' + message, "order socket error")
                }
            },
            () => {
                // The clean termination only happens in response to the last
                // subscription to the observable being unsubscribed, any
                //other closure is considered an error.
                this.logger.log("the ORDER socket connection was closed in response to the user", "order socket")
            },
        )
    }

    private candleStream(key: Key) {
        let candleSet: Candle[] = [];

        this.candleSubscription = this.candleSocketService.messages$.subscribe(
            (message: string) => {
                //const trimmed = message.substring(0, 100)
                // this.logger.log(message, 'candle socket')
                // respond to server
                const data = JSON.parse(message)

                if (data.event === "info") {
                    // if we just connected to the stream we find the last order we want to start from
                    // and we send a message to start the stream
                    this.candleSocketService.setSubscription(key)
                } else {
                    if (data.event) {
                        this.logger.log(data, 'candle socket')
                        return;
                    }

                    if (data[1].length < 6) {
                        return
                    }

                    candleSet = this.parseCandlesService.handleCandleStream(data, key, candleSet)
                    const currentCandle: Candle = candleSet[candleSet.length - 1]

                    // this is a questionable hack to sort out missing candles
                    if (!currentCandle) {
                        this.logger.log(key, 'candle socket key')
                        this.logger.log("Borked!", "candle socket error")
                    }

                    // TODO: This price needs to be changed to real (current price???).
                    this.currentPrice = currentCandle.close;

                    if (candleSet && candleSet.length > 1 && !this.orderCycleService.getLastUnFilledBuyOrderId(key)) {
                        const orderId = this.behaviorService.nextOrderIdThatMatchesRules(candleSet, key)
                        //const orderId = 101;
                        // await new Promise(r => setTimeout(r, 500));
                        if (orderId && this.orderSocketService.getSocketReadyState()) {
                            this.logger.log(data, 'candle socket')
                            const order = { ...this.ordersService.getOrder(key, orderId, currentCandle.close) }

                            let buyPrice = 0
                            if (order.meta.id != 101) {
                                buyPrice = this.behaviorService.getBuyOrderPrice(candleSet)
                                order['price'] = buyPrice
                            }

                            this.orderCycleService.addBuyOrder(key, order, buyPrice)
                            this.orderSocketService.makeOrder(order)

                            candleSet = []
                        }
                    }

                }
            },
            (error: Error) => {
                const { message } = error
                if (message === normalClosureMessage) {
                    this.logger.log("server closed the CANDLE websocket connection normally", "candle socket")
                } else {
                    this.logger.log('CANDLE socket was disconnected due to error: ' + message, "candle socket error")
                }
            },
            () => {
                // The clean termination only happens in response to the last
                // subscription to the observable being unsubscribed, any
                // other closure is considered an error.
                this.logger.log("the CANDLE socket connection was closed in response to the user", "candle socket")
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
