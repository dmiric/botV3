import { Injectable, Inject, Logger, LoggerService } from '@nestjs/common'
import { Candle } from '../../interfaces/candle.model'

import { ParseCandlesService } from '../../candles/parsecandles.service'

import { BencBehaviourService } from '../../behaviour/bencbehaviour.service'
import { BFXReqService } from '../bfxreq.service'
import { RestService } from '../rest.service';
import { TradeSession } from '../../tradesession/models/tradesession.entity'
import { BuyOrderBLService } from '../../order/buyorder.bl.service';

import { SellOrderBLService } from '../../order/sellorder.bl.service'
import { SocketsService } from '../bfx.sockets.service'
import { BuyOrder } from '../../order/models/buyOrder.entity'

@Injectable()
export class StrategyOneService {

    // position
    private activePosition = [];
    private currentPrice = 0;
    private activePositionMaxPerc = 0;

    // trailing order
    private trailingOrderSent = false;
    private trailingStopOrderId = 0;

    private lastTradeSystemGroup = 0;
    private lastCandleCount = 0;
    private currentCandleMts = 0;
    private candleSet: Candle[] = [];

    private lastBuyOrder = null
    private lastPositionUpdateTime

    constructor(
        private readonly parseCandlesService: ParseCandlesService,
        private readonly behaviorService: BencBehaviourService,
        private readonly bfxReqService: BFXReqService,
        private readonly restService: RestService,
        @Inject(Logger) private readonly logger: LoggerService,
        private readonly buyOrderBLService: BuyOrderBLService,
        private readonly sellOrderBLService: SellOrderBLService,
        private readonly socketsService: SocketsService
    ) { }

    async closePosition(tradeSession: TradeSession): Promise<void> {
        if (!this.activePosition && this.activePosition.length < 1) {
            return
        }
        // check if position is positive
        // check if we are in profit over 0.5% - position[7]
        if (this.activePosition[2] > 0 && this.activePosition[7] > tradeSession.closePercent && this.activePosition[7] > 0.5) {
            // cancel all buy orders for the symbol
            const activeOrders = await this.restService.fetchOrders(tradeSession.symbol)
            for (const o of activeOrders) {
                const pl = this.bfxReqService.cancelOrder(o[0])
                this.socketsService.send('orderSocket', pl)
            }

            // cancel trailng stop order
            if (this.trailingOrderSent && this.trailingStopOrderId > 0) {
                const pl = this.bfxReqService.cancelOrder(this.trailingStopOrderId)
                this.socketsService.send('orderSocket', pl)
            }

            const order = await this.sellOrderBLService.createSellOrder(tradeSession, 'MARKET', this.activePosition[2], this.currentPrice)
            const pl = this.bfxReqService.makeSellOrder(order)
            if (pl) {
                await order.send()
                this.lastBuyOrder = order;
                this.sellOrderBLService.updateSellOrder(order)
                this.socketsService.send('orderSocket', pl)
            }
        }
    }

    setTrailingOrderSent(trailing: boolean): void {
        // set trailing order if present
        this.trailingOrderSent = trailing
    }

    public async candleStream(message: string, tradeSession: TradeSession): Promise<void> {
        const data = JSON.parse(message)
        await new Promise(r => setTimeout(r, 1025));

        if (data.event) {
            this.logger.log(data, 'candle socket')
            this.logger.log(tradeSession, 'event key')
            return;
        }

        if (data[1].length < 6) {
            return
        }

        this.candleSet = { ...this.parseCandlesService.handleCandleStream(data, tradeSession, this.candleSet)}

        const currentCandle: Candle = this.candleSet[this.candleSet.length - 1]
        const lastBuyOrder = await this.buyOrderBLService.getPrevBuyOrder(tradeSession)

        if (!lastBuyOrder) {
            const order = await this.buyOrderBLService.createBuyOrder(tradeSession, 'MARKET', 1, currentCandle)
            order.amount = this.getAmount(tradeSession, order, currentCandle)
            if (order) {
                this.lastTradeSystemGroup = order.tradeSystemGroup
                const pl = this.bfxReqService.makeBuyOrder(order)
                if (pl) {
                    await order.send()
                    this.lastBuyOrder = order;
                    await this.buyOrderBLService.updateBuyOrder(order)
                    this.socketsService.send('orderSocket', pl)
                    await new Promise(r => setTimeout(r, 100));
                }
                this.candleSet = []
                this.lastCandleCount = 0
            }
        }

        // if we don't have one more candle at this point no need to continue
        if (this.candleSet && this.candleSet.length > this.lastCandleCount) {
            this.lastCandleCount = this.candleSet.length
            this.logger.log(this.lastCandleCount + ":" + this.candleSet.length, 'candle count')
            // this.logger.log(currentCandle, 'current candle')
        } else {
            return
        }

        // TODO: This price needs to be changed to real (current price???).
        this.currentPrice = currentCandle.close;

        if (!lastBuyOrder) {
            return
        }

        // get stack of candles to run a price check on
        if (this.candleSet.length > 200) {
            // this.logger.log(lastBuyOrder, 'lastBuyOrder candles > 200')
            if (lastBuyOrder.status == 'filled') {
                const tradeTimestamp = lastBuyOrder.tradeTime
                this.logger.log([tradeTimestamp, this.candleSet[this.candleSet.length - 1].mts], 'tradeTimeStamp : lastCandle mts')
                if (tradeTimestamp > this.candleSet[this.candleSet.length - 1].mts) {
                    this.candleSet = this.behaviorService.getCandleStack(this.candleSet, tradeTimestamp)
                    this.lastCandleCount = this.candleSet.length
                    this.logger.log(this.candleSet, 'trim candle set')
                }
            } else {
                if (lastBuyOrder.tradeSystemGroup > 1) {
                    this.candleSet = []
                    this.lastCandleCount = 0
                    this.logger.log(this.candleSet, 'full reset candle set 1')
                }
            }
        }
        // lastBuyOrder.status == 'filled' needs to be replaced with some better condition maybe add canceled or something
        if (this.candleSet && this.candleSet.length > 1 && lastBuyOrder.status == 'filled') {
            const tradeSystemGroup = await this.behaviorService.nextTradeSystemGroupThatMatchesRules(this.candleSet, tradeSession, lastBuyOrder)

            // await new Promise(r => setTimeout(r, 500));
            if (tradeSystemGroup && this.lastTradeSystemGroup != tradeSystemGroup) {
                const order = await this.buyOrderBLService.createBuyOrder(tradeSession, 'LIMIT', tradeSystemGroup, currentCandle)

                order.amount = this.getAmount(tradeSession, order, currentCandle)

                const buyPrice = this.behaviorService.getBuyOrderPrice(this.candleSet)
                order.price = buyPrice
                await this.buyOrderBLService.updateBuyOrder(order)

                this.lastTradeSystemGroup = order.tradeSystemGroup
                this.candleSet = []
                this.lastCandleCount = 0
            }
        }
    }

    private getAmount(tradeSession: TradeSession, order: BuyOrder, currentCandle: Candle): number {
        const tradeSystem = JSON.parse(tradeSession.buyRules.rules)
        const amount = tradeSession.startBalance * tradeSystem[order.tradeSystemGroup] / 100 / currentCandle.close
        return parseFloat(amount.toFixed(4))
    }


    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public async tradeStream(data: any, tradeSession: TradeSession): Promise<void> {

        // pu: position update
        if (data[1] == 'pu') {
            // we don't want all positions in log
            if (data[2][0] == tradeSession.symbol) {
                this.logger.log(data, "pu")
            }
        } else {
            if (data[1] !== 'bu' && data[1] !== 'wu') {
                this.logger.log(data, "not pu")
            }
        }

        if (data.event) {
            return;
        }

        // hb: hearth beat
        if (data[1] == 'hb') {
            const pl = this.bfxReqService.requestReqcalc()
            this.socketsService.send('orderSocket', pl)
            return
        }

        // ws: wallet snapshot
        if (data[1] == 'ws') {
            //if (!reconnect) {
            //this.candleStream(tradeSession)
            //this.logger.log(tradeSession, 'start -candle socket- with this key')
            //}
            return
        }

        // wu: wallet update
        if (data[1] == 'wu') {
            // make orders that are not executed
            const order = await this.buyOrderBLService.getPrevBuyOrder(tradeSession)

            if (!order) {
                return
            }

            if (order.status == 'new') {
                await order.send()
                const pl = this.bfxReqService.makeBuyOrder(order)
                if (pl) {
                    await this.buyOrderBLService.updateBuyOrder(order)
                    this.socketsService.send('orderSocket', pl)
                }
            }
            return
        }

        // ps: position snapshot
        if (data[1] == 'ps') {
            return
        }

        // pu: position update
        if (data[1] == 'pu') {
            if (data[2][0] !== tradeSession.symbol) {
                return
            }

            this.lastPositionUpdateTime = Date.now()

            if (data[2][1] == 'ACTIVE') {
                this.activePosition = data[2]
            }

            if (data[2][7] > this.activePositionMaxPerc) {
                this.activePositionMaxPerc = data[2][7]
            }

            // if profit reached X% set tracking order
            if (tradeSession.originalTrailingProfit != null && tradeSession.originalTrailingDistance != null) {
                if (data[2][1] !== 'ACTIVE' || this.trailingOrderSent || !this.currentPrice) {
                    return
                }

                let trailingProfit = tradeSession.originalTrailingProfit;
                let trailingDistance = tradeSession.originalTrailingDistance;

                if (tradeSession.overrideTrailingProfit !== null && tradeSession.overrideTrailingDistance !== null) {
                    trailingProfit = tradeSession.overrideTrailingProfit
                    trailingDistance = tradeSession.overrideTrailingDistance
                }

                if (data[2][7] > trailingProfit) {
                    const priceTrailing = this.currentPrice * (trailingDistance / 100)

                    // cancel all buy orders for the symbol
                    // const activeOrders = await this.restService.fetchOrders(key.symbol)
                    const buyOrders = await this.buyOrderBLService.getBuyOrders(tradeSession)
                    for (const buyOrder of buyOrders) {
                        if (buyOrder.status != 'filled' && buyOrder.status != 'canceled') {
                            const pl = this.bfxReqService.cancelOrder(buyOrder.exchangeId)
                            this.socketsService.send('orderSocket', pl)
                        }
                    }

                    const order = await this.sellOrderBLService.createSellOrder(tradeSession, 'TRAILING STOP', data[2][2], this.currentPrice, priceTrailing)
                    this.trailingOrderSent = true
                    const pl = this.bfxReqService.makeSellOrder(order)
                    if (pl) {
                        await order.send()
                        this.lastBuyOrder = order;
                        this.sellOrderBLService.updateSellOrder(order)
                        this.socketsService.send('orderSocket', pl)
                    }

                }
            }
            return
        }

        // pc: position closed
        if (data[1] == 'pc') {
            if (data[2][0] !== tradeSession.symbol) {
                return
            }

            // this.resetTradeProcess(tradeSession)
            return
        }

        // te: trade executed
        if (data[1] == 'te') {
            const teOrder = data[2]
            if (data[2][1] !== tradeSession.symbol) {
                return
            }

            const order = await this.buyOrderBLService.findBuyOrderByCid(tradeSession, teOrder[11])

            if (order.status == 'filled') {
                return
            }

            const exAmount = teOrder[4]

            if (exAmount > 0 && order) {
                let tradeExecuted = false
                if (exAmount + order.boughtAmount >= order.amount) {
                    tradeExecuted = true
                }

                this.logger.log(data, "te: trade executed")
                this.logger.log(tradeSession, "te: trade executed")
                order.price = data[2][5]
                order.boughtAmount = exAmount + order.boughtAmount
                order.tradeTime = data[2][5]
                order.exchangeId = data[2][0]

                if (tradeExecuted === false) {
                    await order.partialyFill()
                }

                if (tradeExecuted === true) {
                    await order.fill()
                }

                await this.buyOrderBLService.updateBuyOrder(order)

            }
            return
        }

        // tu: trade execution update
        if (data[1] == 'tu') {
            const teOrder = data[2]
            if (data[2][6] > 0) {
                const bo = await this.buyOrderBLService.findBuyOrderByCid(tradeSession, teOrder[11])

                if (!bo || bo.symbol !== tradeSession.symbol) {
                    return
                }

                bo.fee = teOrder[9]
                bo.price = teOrder[5]

                if (bo.status != 'filled') {
                    await bo.fill()
                }

                await this.buyOrderBLService.updateBuyOrder(bo)
            }

            if (data[2][6] < 0) {
                const so = await this.sellOrderBLService.findSellOrderByCid(tradeSession, teOrder[11])

                if (!so || so.symbol !== tradeSession.symbol) {
                    return
                }

                so.fee = teOrder[9]

                if (so.status != 'filled') {
                    await so.fill()
                }

                await this.sellOrderBLService.updateSellOrder(so)
            }
        }

        // on: order new
        if (data[1] == 'n') {
            const nOrder = data[2][4]

            if (nOrder === null || nOrder[3] !== tradeSession.symbol) {
                return
            }

            if (nOrder[6] > 0) {
                const order = await this.buyOrderBLService.findBuyOrderByCid(tradeSession, nOrder[2])

                if (order && order.status == 'sent') {
                    order.exchangeId = nOrder[0]
                    await order.recieve()
                    await this.buyOrderBLService.updateBuyOrder(order)
                }
            }

            if (nOrder[6] < 0) {
                const order = await this.sellOrderBLService.findSellOrderByCid(tradeSession, nOrder[2])
                if (order && order.status == 'sent') {
                    order.exchangeId = nOrder[0]
                    await order.recieve()
                    await this.sellOrderBLService.updateSellOrder(order)
                }
            }
        }

        if (data[1] == 'pn') {
            const exchangeId = data[2][19]['order_id']
            // load order by exId
            if (exchangeId) {
                const order = await this.buyOrderBLService.getBuyOrderByExchangeId(exchangeId)
                if (!order) {
                    return
                }
                order.fill()
                await this.buyOrderBLService.updateBuyOrder(order)
            }
        }

        // on: order new
        if (data[1] == 'on') {
            if (data[2][3] !== tradeSession.symbol) {
                return
            }

            if (data[2][6] > 0) {
                const order = await this.buyOrderBLService.findBuyOrderByCid(tradeSession, data[2][2])

                // if it's LIMIT order we made
                if (order && order.status == 'recieved') {
                    order.exchangeId = data[2][0]
                    await order.confirm()
                    await this.buyOrderBLService.updateBuyOrder(order)
                }

                // if it's LIMIT order made manualy on BFX
                /*
                if (data[2][8] == 'LIMIT' && !order) {
                    const newOrder = await this.buyOrderBLService.addCustomBuyOrder(tradeSession, data[2])

                    const pl = this.bfxReqService.cancelOrder(data[2][0])
                    if (pl) {
                        this.socketsService.send('orderSocket', pl)
                    }

                    const pl2 = this.bfxReqService.makeBuyOrder(newOrder)
                    if (pl2) {
                        newOrder.send()
                        this.socketsService.send('orderSocket', pl2)
                        this.buyOrderBLService.updateBuyOrder(newOrder)
                    }
                }
                */
            }

            if (data[2][6] < 0) {
                const newOrder = await this.sellOrderBLService.findSellOrderByCid(tradeSession, data[2][2])
                if (newOrder && newOrder.status == 'recieved') {
                    newOrder.confirm()
                    await this.sellOrderBLService.updateSellOrder(newOrder)
                    this.setTrailingOrderSent(true)
                    this.trailingStopOrderId = data[2][0]
                }
            }

        }

        // ou: order update
        if (data[1] == 'ou') {
            if (data[2][3] !== tradeSession.symbol) {
                return
            }

            const newOrder = await this.buyOrderBLService.findBuyOrderByCid(tradeSession, data[2][2])

            // if it's LIMIT order we made
            if (data[2][8] == 'LIMIT' && newOrder) {
                newOrder.price = data[2][0]
                await this.buyOrderBLService.updateBuyOrder(newOrder)
            }
            return
        }

        // os: order snapshot
        if (data[1] == 'os') {
            for (const order of data[2]) {
                if (order[8] == 'TRAILING STOP' && order[3] == tradeSession.symbol) {
                    this.setTrailingOrderSent(true)
                    this.trailingStopOrderId = order[0]
                }

                // cancel orphan order
                if (order[8] == 'LIMIT' && order[3] == tradeSession.symbol && order[31] !== null &&
                    order[31].hasOwnProperty('tradeSessionId') && order[31]['tradeSessionId'] != tradeSession.id) {
                    const pl = this.bfxReqService.cancelOrder(order[0])
                    this.socketsService.send('orderSocket', pl)
                    this.logger.log(order, "os: orphan order canceled")
                }

                if (order[8] == 'LIMIT' && order[3] == tradeSession.symbol && order[31] === null) {
                    const newOrder = await this.buyOrderBLService.addCustomBuyOrder(tradeSession, order)

                    const pl = this.bfxReqService.cancelOrder(order[0])
                    if (pl) {
                        this.socketsService.send('orderSocket', pl)
                    }

                    const pl2 = this.bfxReqService.makeBuyOrder(newOrder)
                    if (pl2) {
                        newOrder.send()
                        this.buyOrderBLService.updateBuyOrder(newOrder)
                        this.socketsService.send('orderSocket', pl2)
                    }
                }

                // add already established custom orders
                // if (order[8] == 'LIMIT' && order[3] == tradeSession.symbol && order[31] !== null &&
                //    order[31].hasOwnProperty('tradeSessionId') && order[31]['tradeSessionId'] === tradeSession.id && order[31]['type'] == 'custom') {
                //    this.orderCycleService.addCustomBuyOrder(tradeSession, order)
                //    this.orderCycleService.updateBuyOrder(tradeSession, order[2], { sentToEx: true });
                // }
            }
            return
        }

        // oc: order cancel
        if (data[1] == 'oc') {
            if (data[2][3] != tradeSession.symbol) {
                return
            }

            if (data[2][0] == this.trailingStopOrderId) {
                this.trailingOrderSent = false;
                this.trailingStopOrderId = 0;
            }
            return
        }
    }
}