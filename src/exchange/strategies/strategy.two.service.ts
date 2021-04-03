import { Injectable, Inject, Logger, LoggerService } from '@nestjs/common'
import { Candle } from '../../interfaces/candle.model'

import { ParseCandlesService } from '../../candles/parsecandles.service'

import { BFXReqService } from '../bfxreq.service'
import { TradeSession } from '../../tradesession/models/tradesession.entity'
import { BuyOrderBLService } from '../../order/buyorder.bl.service';

import { SellOrderBLService } from '../../order/sellorder.bl.service'
import { SocketsService } from '../bfx.sockets.service'
import { BehaviourTwoService } from '../../behaviour/behaviour.two.service'

@Injectable()
export class StrategyTwoService {

    private candleSet: Candle[] = []
    private lastBuyCandle: Candle
    private wallet = { USD: 0 }
    private unfilledSellOrders = []
    private balance = {
        balance: null,
        percent: null,
        reserveAmount: null
    }

    constructor(
        private readonly parseCandlesService: ParseCandlesService,
        private readonly behaviorService: BehaviourTwoService,
        private readonly bfxReqService: BFXReqService,
        @Inject(Logger) private readonly logger: LoggerService,
        private readonly buyOrderBLService: BuyOrderBLService,
        private readonly sellOrderBLService: SellOrderBLService,
        private readonly socketsService: SocketsService
    ) { }

    async candleStream(message: string, tradeSession: TradeSession): Promise<void> {
        const data = JSON.parse(message)
        // this.logger.log(message, 'current candle')

        if (data.event) {
            this.logger.log(data, 'candle socket')
            this.logger.log(tradeSession, 'event key')
            return;
        }

        if (data[1] && data[1].length < 5) {
            return
        }

        this.candleSet = this.parseCandlesService.handleCandleStream(data, tradeSession, this.candleSet)

        const currentCandle: Candle = this.candleSet[this.candleSet.length - 1]
        const currentTick: Candle = this.candleSet[-1]

        if (!currentCandle || !currentTick) {
            return
        }

        if (tradeSession.ma != null && !currentTick.hasOwnProperty("ma")) {
            if (this.candleSet.length > tradeSession.ma) {
                const calcMACandleSet = this.candleSet
                delete calcMACandleSet[-1]
                currentTick.ma = this.calcMA(tradeSession, calcMACandleSet)
            }
        }

        if (this.unfilledSellOrders.length > 0) {
            let sellRules = JSON.parse(tradeSession.sellRules.rules)

            if (tradeSession.salesRules) {
                for (const salesRule of tradeSession.salesRules) {
                    const sR = JSON.parse(salesRule.rules)
                    if (this.balance.percent < sR.balancePercent / 100) {
                        sellRules = sR.rules
                    }
                }
            }

            for (const [index, sellOrderData] of this.unfilledSellOrders.entries()) {
                const sellPrice = sellOrderData.price + sellOrderData.price * sellRules[sellOrderData.priceDiff] * sellOrderData.priceDiff / 10000
                if (currentTick.close > sellPrice) {
                    const sellOrders = await this.sellOrderBLService.findByIds([sellOrderData.id])
                    const sellOrder = sellOrders[0]
                    sellOrder.price = sellPrice
                    const pl = this.bfxReqService.makeSellOrder(sellOrder)
                    if (pl) {
                        await sellOrder.send()
                        sellOrder.candleMts = currentTick.mts
                        sellOrder.candleOpen = currentTick.open
                        sellOrder.candleClose = currentTick.close
                        await this.sellOrderBLService.updateSellOrder(sellOrder)
                        await new Promise(r => setTimeout(r, 30))
                        this.socketsService.send('orderSocket', pl)
                        this.unfilledSellOrders.splice(index, 1)
                    }
                }
            }
        }

        if (this.lastBuyCandle == currentCandle) {
            return
        }

        if (currentTick.hasOwnProperty("ma")) {
            if (currentTick.close > currentTick.ma) {
                return
            }
        }

        // create buy order
        const closePercent = await this.behaviorService.checkCompletedCandles(currentCandle, tradeSession)
        const lowPercent = await this.behaviorService.checkTicks(currentTick, tradeSession)

        // think about using rest here to send orders instead of socket to make sure they land
        if (!closePercent && !lowPercent) {
            return
        }

        const priceDiffPerc = lowPercent ? lowPercent : closePercent // only used in backtest
        const estPrice = lowPercent ? currentTick.open - (currentTick.open * lowPercent / 100) : currentCandle.close
        const candle = lowPercent ? currentTick : currentCandle
        const amount = this.getAmount(tradeSession, priceDiffPerc, estPrice)
        const priceDiffLow = JSON.parse(tradeSession.priceDiffLow)
        const useReserve = lowPercent || closePercent >= priceDiffLow.low ? true : false

        // skip if we have reached the balance
        if (this.balanceCheck(tradeSession, amount, estPrice, useReserve)) {
            return
        }

        this.lastBuyCandle = currentCandle
        const order = await this.buyOrderBLService.createBuyOrder(tradeSession, 'EXCHANGE MARKET', priceDiffPerc, candle)
        order.amount = amount
        await order.send()
        const pl = this.bfxReqService.makeBuyOrder(order)
        if (pl) {
            await new Promise(r => setTimeout(r, 30));
            order.price = estPrice
            await this.buyOrderBLService.updateBuyOrder(order)
            await new Promise(r => setTimeout(r, 30));
            this.socketsService.send('orderSocket', pl)
        }
        this.candleSet = []
    }

    private calcMA(tradeSession: TradeSession, candleSet: Candle[]): number {
        const maCandleSet = candleSet.slice(Math.max(candleSet.length - tradeSession.ma, 0))

        let ma = 0
        for (const candle of maCandleSet) {
            ma = ma + candle.close
        }

        return ma / tradeSession.ma
    }

    private async updateUnfilledSellOrders(tradeSession: TradeSession): Promise<void> {
        // check if we need to sell something
        const sellOrderQB = this.sellOrderBLService.getQueryBuilder()
        const sellOrders = await sellOrderQB
            .select("SellOrder.id", "id")
            .addSelect("bo.price", "price")
            .addSelect("bo.tradeSystemGroup", "priceDiff")
            .addSelect("bo.amount", "amount")
            //.addSelect("ROUND(SUM(bo.amount*bo.price))", "total")
            .innerJoin("SellOrder.buyOrder", "bo")
            .where("SellOrder.gid = :gid", { gid: tradeSession.id })
            .andWhere("bo.status = :status1", { status1: "filled" })
            .andWhere("SellOrder.status = :status2", { status2: "new" })
            .getRawMany()

        this.unfilledSellOrders = sellOrders
        await this.updateBalance(tradeSession)
    }

    private async updateBalance(tradeSession: TradeSession): Promise<void> {
        const sellOrderQB1 = this.sellOrderBLService.getQueryBuilder()
        const sellTotal = await sellOrderQB1
            .select("ROUND(SUM(bo.amount*bo.price))", "total")
            .innerJoin("SellOrder.buyOrder", "bo")
            .where("SellOrder.gid = :gid", { gid: tradeSession.id })
            .andWhere("bo.status = :status1", { status1: "filled" })
            .andWhere("SellOrder.status = :status2", { status2: "new" })
            .getRawOne()

        const requiredReserve = this.calcReserve(tradeSession)
        const potentialBalance = tradeSession.startBalance - requiredReserve - sellTotal.total

        if (potentialBalance <= 0) {
            this.balance.reserveAmount = requiredReserve + potentialBalance
            this.balance.balance = 0
        } else {
            this.balance.balance = potentialBalance
        }

        this.balance.percent = this.balance.balance / (tradeSession.startBalance - requiredReserve)
    }

    private balanceCheck(tradeSession: TradeSession, amount: number, estPrice: number, useReserve: boolean): boolean {
        this.setBalance(tradeSession)
        const potentialValue = amount * estPrice

        if (useReserve) {
            if (this.balance.balance + this.balance.reserveAmount - potentialValue >= 1) {
                return false
            }
            if (potentialValue >= this.wallet.USD) {
                return false
            }
        }

        if (this.balance.balance - potentialValue >= 1) {
            return false
        }

        if (potentialValue >= this.wallet.USD) {
            return false
        }

        return true
    }

    private setBalance(tradeSession: TradeSession) {
        const priceDiffLow = JSON.parse(tradeSession.priceDiffLow)

        let reserveAmount = 0
        if (priceDiffLow != null) {
            reserveAmount = this.calcReserve(tradeSession)
        }

        if (this.balance.balance === null) {
            this.balance.balance = tradeSession.startBalance - reserveAmount
            this.balance.percent = 1
            this.balance.reserveAmount = reserveAmount
        }
    }

    private calcReserve(tradeSession: TradeSession): number {
        const priceDiffLow = JSON.parse(tradeSession.priceDiffLow)
        if (!priceDiffLow.hasOwnProperty('reserve')) {
            return 0
        }

        const buyRules = JSON.parse(tradeSession.buyRules.rules)
        const reserve = buyRules[priceDiffLow.low] * tradeSession.investment * priceDiffLow.reserve

        return reserve
    }

    private getAmount(tradeSession: TradeSession, priceDiffPerc: number, estPrice: number): number {
        const buyRules = JSON.parse(tradeSession.buyRules.rules)
        const amount = tradeSession.investment * buyRules[priceDiffPerc] / estPrice
        return parseFloat(amount.toFixed(4))
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    async tradeStream(data: any, tradeSession: TradeSession): Promise<void> {
        // pu: position update
        if (data[1] == 'pu') {
            // we don't want all positions in log
            if (data[2][0] == tradeSession.symbol) {
                // this.logger.log(data, "pu")
            }
        } else {
            if (data[1] !== 'bu' && data[1] !== 'wu') {
                this.logger.log(data, "not pu")
            }
        }

        if (data.event) {
            return
        }

        // wu: wallet snapshot
        if (data[1] == 'ws') {
            await this.updateUnfilledSellOrders(tradeSession)
            for (const entry of data[2]) {
                if (entry[0] == 'exchange') {
                    this.wallet[entry[1]] = entry[4]
                }
            }
        }

        // wu: wallet update
        if (data[1] == 'wu') {
            if (data[2][0] == 'exchange') {
                this.wallet[data[2][1]] = data[2][4]
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
            return
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
            }

            if (data[2][6] < 0) {
                const newOrder = await this.sellOrderBLService.findSellOrderByCid(tradeSession, data[2][2])
                if (newOrder && newOrder.status == 'recieved') {
                    newOrder.confirm()
                    await this.sellOrderBLService.updateSellOrder(newOrder)
                    await this.updateUnfilledSellOrders(tradeSession)
                }
            }
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

                if (teOrder[5] != null) {
                    bo.price = teOrder[5]
                }

                if (bo.status != 'filled') {
                    await bo.fill()
                }

                await this.buyOrderBLService.updateBuyOrder(bo)

                const sellOrder = await this.sellOrderBLService.createSellOrder(tradeSession, 'EXCHANGE TRAILING STOP', bo.amount)
                sellOrder.buyOrder = bo
                await this.sellOrderBLService.updateSellOrder(sellOrder)
                await this.updateUnfilledSellOrders(tradeSession)
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
                await this.updateUnfilledSellOrders(tradeSession)
            }
            return
        }

        // oc: order cancel
        if (data[1] == 'oc') {
            if (data[2][3] != tradeSession.symbol) {
                return
            }
        }
    }
}