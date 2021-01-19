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
import { RestService } from './rest.service';

@Injectable()
export class TradeService {

    private tradeStatus = false;
    private stoppedManually = false;
    private starting = false;

    private candleSubscription: Subscription;
    private orderSubscription: Subscription;

    private activePosition = [];
    private currentPrice = 0;

    private lastSignal: Key;
    private lastSignalTime: string;

    private lastPositionUpdateTime = 0;

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
        private restService: RestService,
        @Inject(Logger) private readonly logger: LoggerService
    ) { }

    getStatusInfo(): any {
        const behaviourInfo = this.behaviorService.getBehaviourInfo()
        let status = {}
        status = this.orderCycleService.getStatus()
        status['tradeStatus'] = this.tradeStatus
        status['stoppedManually'] = this.stoppedManually
        status['trailingStopOrder'] = this.trailingOrderSent
        status['trailingStopOrderId'] = this.trailingStopOrderId
        status['activePosition'] = this.activePosition
        status['lastSignal'] = this.lastSignal
        status['lastSignalTime'] = this.lastSignalTime
        status['behaviourInfo'] = {
            'candle_count': behaviourInfo['candles'].length ? behaviourInfo['candles'].length : 0,
            'maxReach': behaviourInfo['maxReach'],
            'nextOrder': behaviourInfo['nextOrder']
        }
        return status;
    }

    getStatus(): boolean {
        return this.tradeStatus;
    }

    setStatus(status: boolean): boolean {
        return this.tradeStatus = status;
    }

    setStarting(status: boolean): boolean {
        return this.starting = status;
    }

    isStarting(): boolean {
        return this.starting
    }

    isStopped(): boolean {
        return this.stoppedManually
    }

    setLastSignal(key: Key): void {
        this.lastSignal = key;
        const d = new Date();
        this.lastSignalTime = d.toString();

        this.logger.log(this.lastSignal, "signal")
        this.logger.log(this.lastSignalTime, "signal")
    }

    async closePosition(key: Key): Promise<void> {
        this.setLastSignal(key)
        // check if trade is active
        // check if position is positive
        // check if we are in profit over 0.5% - position[7]
        if (this.trailingOrderSent && this.trailingStopOrderId > 0) {
            this.orderSocketService.cancelOrder(this.trailingStopOrderId)
        }

        // cancel all buy orders for the symbol
        const activeOrders = await this.restService.fetchOrders(key.symbol)
        for (const o of activeOrders) {
            this.orderSocketService.cancelOrder(o[0])
        }

        if (this.getStatus() && this.activePosition[2] > 0 && this.activePosition[7] > 0.5) {
            this.orderSocketService.closePosition(key, this.activePosition[2])
        }
    }

    restartTrade(key: Key, lastBuyOrder: Order): void {
        // set lastBuyOrder in OrderCycle
        this.orderCycleService.addBuyOrder(key, lastBuyOrder, lastBuyOrder.price)
        // use key to start the trade again
        this.trade(key)
    }

    setTrailingOrderSent(trailing: boolean): void {
        // set trailing order if present
        this.trailingOrderSent = trailing
    }

    trade(key: Key, reconnect = false): void {
        this.setLastSignal(key)
        this.lastPositionUpdateTime = 0

        this.tradeStatus = true
        this.orderCycleService.setCurrentTimeFrame(key)

        this.orderSocketService.createSocket()

        this.orderSubscription = this.orderSocketService.messages$.subscribe(
            (message: string) => {

                if (!this.getStatus() || this.isStopped() || this.isStarting()) {
                    return
                }

                // respond to server
                const data = JSON.parse(message)

                // pu: position update
                if (data[1] == 'pu') {
                    // we don't want all positions in log
                    if (data[2][0] == key.symbol) {
                        this.logger.log(data, "order socket")
                    }
                } else {
                    if (data[1] !== 'bu') {
                        this.logger.log(data, "order socket")
                    }
                }

                if (data.event === "info") {

                    // if we just connected to the stream we find the last order we want to start from
                    // and we send a message to start the stream
                    this.orderSocketService.auth()
                } else {
                    // hb: hearth beat
                    if (data.event) {
                        return;
                    }

                    // hb: hearth beat
                    if (data[1] == 'hb') {
                        this.orderSocketService.requestReqcalc(key)

                        // hack to reconnect if position update is late 1 minute
                        const secDelay = Math.floor((Date.now() - this.lastPositionUpdateTime) / 1000)
                        if (secDelay > 60) {
                            this.orderSocketService.setReadyState(false)
                            // unsub from order stream
                            this.orderSubscription.unsubscribe()
                            this.logger.log(data, "reconnecting to order socket")
                            this.trade(key, true)
                        }
                    }

                    // ws: wallet snapshot
                    if (data[1] == 'ws') {
                        this.orderSocketService.setReadyState(true)
                        if (!reconnect) {
                            this.candleStream(key)
                        }
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

                        this.lastPositionUpdateTime = Date.now()

                        if (data[2][1] == 'ACTIVE') {
                            this.activePosition = data[2]
                        }

                        // if profit reached X% set tracking order
                        if (key.hasOwnProperty('trailingProfit') && key.hasOwnProperty('trailingDistance')) {
                            if (data[2][1] !== 'ACTIVE' || this.trailingOrderSent || !this.currentPrice) {
                                return
                            }

                            if (data[2][7] > key.trailingProfit) {
                                const priceTrailing = this.currentPrice * (key.trailingDistance / 100)

                                // cancel all buy orders for the symbol
                                // const activeOrders = await this.restService.fetchOrders(key.symbol)
                                const buyOrders = this.orderCycleService.getBuyOrders(key)
                                for (const o of buyOrders) {
                                    this.orderSocketService.cancelOrder(o.meta.ex_id)
                                }

                                this.orderSocketService.makeTrailingOrder(key, data[2][2], priceTrailing)
                                this.trailingOrderSent = true
                                //this.resetTradeProcess(key)
                            }
                        }
                    }

                    // pc: position closed
                    if (data[1] == 'pc') {
                        if (data[2][0] !== key.symbol) {
                            return
                        }

                        if (data[2][19]['order_id'] == this.trailingStopOrderId) {
                            this.setTrailingOrderSent(false)
                            this.trailingStopOrderId = 0
                        }

                        this.resetTradeProcess(key)
                    }

                    // te: trade executed
                    if (data[1] == 'te') {
                        //message: [0,"te",[563936681,"tTESTBTC:TESTUSD",1609889746511,55970331526,0.0032,33927,"MARKET",33903,-1,null,null,1609889681451]]

                        if (data[2][1] !== key.symbol) {
                            return
                        }

                        // executed trade has to be positive
                        // we are updating buy orders here
                        if (data[2][4] > 0) {
                            this.logger.log(data, "te: trade executed")
                            this.logger.log(key, "te: trade executed")
                            this.orderCycleService.updateBuyOrder(key, data[2][11], { price: data[2][5], tradeExecuted: true, ex_id: data[2][0] });
                        }
                    }

                    // on: order new
                    if (data[1] == 'on') {
                        if (data[2][3] !== key.symbol) {
                            return
                        }

                        if (data[2][8] == 'LIMIT') {
                            this.orderCycleService.updateBuyOrder(key, data[2][2], { ex_id: data[2][0] });
                        }

                        if (data[2][8] == 'TRAILING STOP' && data[2][3] == key.symbol) {
                            this.setTrailingOrderSent(true)
                            this.trailingStopOrderId = data[2][0]
                        }
                    }

                    // os: order snapshot
                    if (data[1] == 'os') {
                        for (const order of data[2]) {
                            if (order[8] == 'TRAILING STOP' && order[3] == key.symbol) {
                                this.setTrailingOrderSent(true)
                                this.trailingStopOrderId = order[0]
                            }
                        }
                    }

                    // oc: order cancel
                    if (data[1] == 'oc') {
                        if (data[2][3] != key.symbol) {
                            return
                        }

                        if (data[2][0] == this.trailingStopOrderId) {
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

                if (!this.getStatus() || this.isStopped() || this.isStarting() || this.trailingOrderSent) {
                    return
                }

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

                    // debug
                    if (candleSet.length > 0 && candleSet.length < 3) {
                        // this.logger.log(candleSet, 'candle set')
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

                    // get stack of candles to run a price check on
                    if (candleSet.length > 220) {
                        const lastBuyOrder = this.orderCycleService.getLastBuyOrder(key)
                        console.log(lastBuyOrder)
                        if (lastBuyOrder) {
                            const tradeTimestamp = lastBuyOrder.meta.tradeTimestamp
                            console.log(typeof tradeTimestamp)
                            console.log(tradeTimestamp)
                            console.log(candleSet[candleSet.length - 1].mts)
                            if (tradeTimestamp > candleSet[candleSet.length - 1].mts) {
                                candleSet = this.behaviorService.getCandleStack(candleSet, tradeTimestamp)
                            }
                        } else {
                            candleSet = []
                        }
                    }

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
        this.logger.log("Resetting...", "reset trade process")
        // unsub candle stream
        this.candleSubscription.unsubscribe()
        // clean up all the data from the previous cycle
        this.orderCycleService.finishOrderCycle(key)
        // unsub from order stream
        this.orderSubscription.unsubscribe()
        // set process inactive
        this.setStatus(false)

        this.logger.log("Done!", "reset trade process")
    }

    stopTrade(): string {
        this.logger.log("Stopping...", "manual stop")
        // unsub candle stream
        this.candleSubscription.unsubscribe()
        // unsub from order stream
        this.orderSubscription.unsubscribe()
        // set process inactive
        this.setStatus(false)

        this.stoppedManually = true
        this.logger.log("Stopped!", "manual stop")
        return "Stopped!"
    }

}
