import { Injectable, Inject, Logger, LoggerService } from '@nestjs/common'
import { Candle } from '../../interfaces/candle.model'

import { ParseCandlesService } from '../../candles/parsecandles.service'

import { BFXReqService } from '../bfxreq.service'
import { TradeSession } from '../../tradesession/models/tradesession.entity'
import { BuyOrderBLService } from '../../order/buyorder.bl.service';

import { SellOrderBLService } from '../../order/sellorder.bl.service'
import { SocketsService } from '../bfx.sockets.service'
import { RestService } from '../rest.service'

import Percentage from 'percentagejs/percentage'
import { BuyOrder } from 'src/order/models/buyOrder.entity'
import { BalanceService } from 'src/balance/balance.service'
import { WalletService } from 'src/wallet/wallet.service'

@Injectable()
export class StrategyTwoService {

    private candleSet: Candle[] = []
    private unfilledSellOrders = []
    private lastCurrentCandle = null
    private lastClosePrice = 0

    constructor(
        private readonly parseCandlesService: ParseCandlesService,
        private readonly rest: RestService,
        private readonly bfxReqService: BFXReqService,
        @Inject(Logger) private readonly logger: LoggerService,
        private readonly buyOrderBLService: BuyOrderBLService,
        private readonly sellOrderBLService: SellOrderBLService,
        private readonly socketsService: SocketsService,
        private readonly balanceService: BalanceService,
        private readonly walletService: WalletService
    ) { }

    async candleStream(message: string, tradeSession: TradeSession): Promise<void> {
        const data = JSON.parse(message)

        if (data.event) {
            this.logger.log(data, 'candle socket')
            return;
        }

        if (data[1] && data[1].length < 5) return

        this.candleSet = this.parseCandlesService.handleCandleStream(data, tradeSession, this.candleSet)

        const currentCandle: Candle = this.candleSet[this.candleSet.length - 1]
        const currentTick: Candle = this.candleSet[-1]

        if (!currentTick) return

        // filter out real ticks
        if (!this.lastCurrentCandle) {
            this.lastCurrentCandle = currentCandle
        }
        if (this.lastCurrentCandle.mts == currentCandle.mts && this.lastCurrentCandle.mts == currentTick.mts) {
            this.lastCurrentCandle = currentCandle
            return
        }
        this.lastCurrentCandle = currentCandle

        // if tick price didnt change return
        if (this.lastClosePrice == currentTick.close) return
        this.lastClosePrice = currentTick.close

        // assign MA to current tick if needed
        if (tradeSession.ma != null && (!currentTick.hasOwnProperty("ma") || currentTick.ma == undefined)) {
            if (this.candleSet.length > tradeSession.ma) {
                delete this.candleSet[-1]
                currentTick.ma = this.calcMA(tradeSession, this.candleSet)
            }
        }

        // update prices for trailing during backtest
        await this.updateSellOrders(currentTick, tradeSession)

        // send sell order to exchange
        await this.makeSellOrder(currentTick, tradeSession)

        const buyPercent = await this.checkBuyOrderRules(currentTick, tradeSession)

        // update buy STOP order if it exists
        const currentBuyOrder = await this.buyOrderBLService.getPrevBuyOrder(tradeSession)

        await this.updateBuyOrders(tradeSession, currentTick, currentBuyOrder, buyPercent)

        // create buy order        
        if (!buyPercent) return
        if (currentBuyOrder && (this.isActiveOrder(currentBuyOrder.status) || currentBuyOrder.status == 'new')) return

        // we are only placing buy order if big (3h) candle is red
        if (currentCandle.close < currentTick.close) return

        const buyPrice = this.calculateBuyPrice(currentTick, tradeSession)
        const amount = this.getAmount(tradeSession, buyPercent, buyPrice)

        // skip if we have reached the balance
        if (this.balanceService.check(tradeSession, amount, buyPrice, buyPercent)) return
        if (await this.checkSafeDistance(tradeSession, buyPrice)) return

        const order = await this.buyOrderBLService.createBuyOrder(tradeSession, 'EXCHANGE STOP', buyPercent, currentTick)
        order.amount = amount
        order.price = buyPrice
        order.send()
        await this.buyOrderBLService.updateBuyOrder(order)
        const pl = this.bfxReqService.makeBuyOrder(order)
        if (pl) this.socketsService.send('orderSocket', pl)
        return
    }

    private async updateBuyOrders(tradeSession: TradeSession, currentTick: Candle, currentBuyOrder: BuyOrder, buyPercent: number) {
        if (!currentBuyOrder) return
        if(!this.isActiveOrder(currentBuyOrder.status)) return

        let orders = []
        if (tradeSession.exchange == 'backtest') {
            orders.push([null, null, currentBuyOrder.cid])
        } else {
            orders = await this.rest.fetchOrders(tradeSession.symbol)
        }

        for (const restOrder of orders) {
            if (restOrder[2] != currentBuyOrder.cid) break

            if (!buyPercent) {
                const pl = this.bfxReqService.cancelOrder(currentBuyOrder.cid)
                this.socketsService.send('orderSocket', pl)
                return
            }

            if (tradeSession.exchange == 'backtest') {
                if (currentBuyOrder.price < currentTick.high) {
                    this.sendTransactionUpdate(tradeSession, currentBuyOrder, currentBuyOrder.amount, currentBuyOrder.price)
                    return
                }
            }

            const newBuyPrice = this.calculateBuyPrice(currentTick, tradeSession)
            const newAmount = this.getAmount(tradeSession, buyPercent, newBuyPrice)

            if (currentBuyOrder.price <= newBuyPrice) return

            // skip if we have reached the balance
            if (this.balanceService.check(tradeSession, newAmount, newBuyPrice, buyPercent)) return

            currentBuyOrder.price = newBuyPrice
            currentBuyOrder.amount = newAmount

            await this.buyOrderBLService.updateBuyOrder(currentBuyOrder,
                {
                    candleMts: currentTick.mts,
                    candleOpen: currentTick.open,
                    candleClose: currentTick.close,
                    tradeSystemGroup: buyPercent
                })

            const pl = this.bfxReqService.updateBuyOrder(currentBuyOrder)
            this.socketsService.send('orderSocket', pl)
        }
    }

    private async checkSafeDistance(tradeSession: TradeSession, buyPrice: number): Promise<boolean> {
        let prevBuyOrder = null

        console.time("answer time");
        const prevBuyOrderData = await this.sellOrderBLService.getQueryBuilder()
            .select("BuyOrder.cid", "cid")
            .addSelect("SellOrder.status", "sellStatus")
            .innerJoinAndSelect("SellOrder.buyOrder", "BuyOrder")
            .where("SellOrder.gid = :gid", { gid: tradeSession.id })
            .andWhere("BuyOrder.status = :buyStatus", { buyStatus: 'filled' })
            .take(1)
            .orderBy("BuyOrder.id", "DESC")
            .getRawOne();

        if (prevBuyOrderData && prevBuyOrderData.sellStatus == 'new') {
            prevBuyOrder = await this.buyOrderBLService.findBuyOrderByCid(tradeSession, prevBuyOrderData.cid)
            console.timeEnd("answer time");
        }

        if (!prevBuyOrder) return false
        const minBuyPrice = Percentage.subPerc(prevBuyOrder.price, tradeSession.safeDistance)
        if (buyPrice > minBuyPrice) return true
        return false
    }

    private isActiveOrder(status: string): boolean {
        const activeStatuses = ['recieved', 'confirmed', 'partialyFilled']
        if (activeStatuses.includes(status)) return true
        return false
    }

    private async updateSellOrders(currentTick: Candle, tradeSession: TradeSession): Promise<void> {
        if (tradeSession.exchange != 'backtest') return
        if (this.unfilledSellOrders.length < 1) return
        let ordersUpdated = 0
        for (const currentSellOrder of this.unfilledSellOrders) {
            if (!currentSellOrder || !this.isActiveOrder(currentSellOrder.status)) continue
            const currentPrice = currentSellOrder.sell_price ? currentSellOrder.sell_price : currentSellOrder.price
            const restOrders = []
            restOrders.push([null, null, currentSellOrder.cid])
            if (currentPrice > currentTick.low) {
                const amount = currentSellOrder.amount - currentSellOrder.amount * 2
                this.sendTransactionUpdate(tradeSession, currentSellOrder, amount, currentPrice)
                continue
            }
            const newSellPrice = this.calculateSellPrice(currentTick, tradeSession)
            if (newSellPrice <= currentPrice) continue
            const sellOrder = await this.sellOrderBLService.findSellOrderByCid(tradeSession, currentSellOrder.cid)
            sellOrder.price = newSellPrice
            await this.sellOrderBLService.updateSellOrder(sellOrder,
                {
                    candleMts: currentTick.mts,
                    candleOpen: currentTick.open,
                    candleClose: currentTick.close
                })
            ordersUpdated++
        }
        if (ordersUpdated) this.updateUnfilledSellOrders(tradeSession)
    }

    private sendTransactionUpdate(tradeSession: TradeSession, order: any, amount: number, price: number) {
        const pl = [0, "tu", [
            null,
            tradeSession.symbol,
            null,
            null,
            order.amount,
            price,
            order.type,
            price,
            null,
            amount * price * 0.002,
            "USD",
            order.cid
        ]]
        this.socketsService.send('orderSocket', pl)
    }

    private calculateSellPrice(currentCandle: Candle, tradeSession: TradeSession) {
        const price = currentCandle.high
        return parseFloat(Percentage.addPerc(price, tradeSession.originalTrailingDistance).toFixed(2))
    }

    private async makeSellOrder(currentTick: Candle, tradeSession: TradeSession): Promise<void> {
        if (this.unfilledSellOrders.length < 1) return
        let sellRules = JSON.parse(tradeSession.sellRules.rules)
        if (tradeSession.salesRules) {
            for (const salesRule of tradeSession.salesRules) {
                const sR = JSON.parse(salesRule.rules)
                if (this.balanceService.getPercent() < sR.balancePercent / 100) {
                    sellRules = sR.rules
                }
            }
        }
        for (const [index, sellOrderData] of this.unfilledSellOrders.entries()) {
            if (sellOrderData.status != 'new') continue
            const sellPrice = sellOrderData.price + sellOrderData.price * sellRules[sellOrderData.priceDiff] * sellOrderData.priceDiff / 10000
            if (currentTick.close < sellPrice) continue
            const sellOrders = await this.sellOrderBLService.findByIds([sellOrderData.id])
            const sellOrder = sellOrders[0]
            sellOrder.price = sellPrice
            const pl = this.bfxReqService.makeSellOrder(sellOrder)
            if (pl) this.socketsService.send('orderSocket', pl)
            await sellOrder.send()
            sellOrder.candleMts = currentTick.mts
            sellOrder.candleOpen = currentTick.open
            sellOrder.candleClose = currentTick.close
            await this.sellOrderBLService.updateSellOrder(sellOrder)
            if (tradeSession.exchange != 'backtest') this.unfilledSellOrders.splice(index, 1)
        }
    }

    private calculateBuyPrice(currentCandle: Candle, tradeSession: TradeSession) {
        let price = currentCandle.close
        if (tradeSession.exchange == 'backtest') {
            price = currentCandle.low
        }
        return parseFloat(Percentage.addPerc(price, tradeSession.buyTrailingDistance).toFixed(2))
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
            .addSelect("SellOrder.price", "sell_price")
            .addSelect("bo.tradeSystemGroup", "priceDiff")
            .addSelect("bo.amount", "amount")
            .addSelect("SellOrder.status", "status")
            .addSelect("SellOrder.cid", "cid")
            .innerJoin("SellOrder.buyOrder", "bo")
            .where("SellOrder.gid = :gid", { gid: tradeSession.id })
            .andWhere("bo.status = :status1", { status1: "filled" })
            .getRawMany()

        this.unfilledSellOrders = sellOrders
        await this.balanceService.update(tradeSession)
    }

    private getAmount(tradeSession: TradeSession, priceDiffPerc: number, estPrice: number): number {
        const buyRules = JSON.parse(tradeSession.buyRules.rules)
        const amount = tradeSession.investment * buyRules[priceDiffPerc] / estPrice
        return parseFloat(amount.toFixed(4))
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    async tradeStream(data: any, tradeSession: TradeSession): Promise<void> {
        this.logger.log(data, "not pu")

        if (data.event) return

        // wu: wallet snapshot
        if (data[1] == 'ws') {
            await this.updateUnfilledSellOrders(tradeSession)
            for (const entry of data[2]) {
                if (entry[0] == 'exchange') {
                    this.walletService.update(entry[1], entry[4])
                }
            }
        }

        // wu: wallet update
        if (data[1] == 'wu') {
            if (data[2][0] == 'exchange') {
                this.walletService.update(data[2][1], data[2][4])
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

        // oc: order canceled
        if (data[1] == 'oc') {
            // cancel order for backtest
            if (tradeSession.exchange == 'backtest') {
                const order = await this.buyOrderBLService.findBuyOrderByCid(tradeSession, data[2][2])
                await order.cancel()
                await this.buyOrderBLService.updateBuyOrder(order)
            }

            if (data[2][3] !== tradeSession.symbol) {
                return
            }

            if (data[2][6] > 0) {
                const order = await this.buyOrderBLService.findBuyOrderByCid(tradeSession, data[2][2])
                if (order) {
                    order.exchangeId = data[2][0]
                    await order.cancel()
                    await this.buyOrderBLService.updateBuyOrder(order)
                }
                return
            }

            if (data[2][6] < 0) {
                const order = await this.sellOrderBLService.findSellOrderByCid(tradeSession, data[2][2])
                if (order) {
                    order.cancel()
                    await this.sellOrderBLService.updateSellOrder(order)
                    await this.updateUnfilledSellOrders(tradeSession)
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
                if (order && order.status == 'recieved') {
                    order.exchangeId = data[2][0]
                    await order.confirm()
                    await this.buyOrderBLService.updateBuyOrder(order)
                }
            }

            if (data[2][6] < 0) {
                const order = await this.sellOrderBLService.findSellOrderByCid(tradeSession, data[2][2])
                if (order && order.status == 'recieved') {
                    order.confirm()
                    await this.sellOrderBLService.updateSellOrder(order)
                    await this.updateUnfilledSellOrders(tradeSession)
                }
            }
            return
        }

        // te: trade executed
        if (data[1] == 'te') {
            const teOrder = data[2]
            if (data[2][1] !== tradeSession.symbol) return
            const order = await this.buyOrderBLService.findBuyOrderByCid(tradeSession, teOrder[11])
            if (order.status == 'filled') return
            const exAmount = teOrder[4]

            if (exAmount > 0 && order) {
                let tradeExecuted = false
                if (exAmount + order.boughtAmount >= order.amount) tradeExecuted = true

                this.logger.log(data, "te: trade executed")
                this.logger.log(tradeSession, "te: trade executed")
                order.price = data[2][5]
                order.boughtAmount = exAmount + order.boughtAmount
                order.tradeTime = data[2][5]
                order.exchangeId = data[2][0]

                if (tradeExecuted === false) await order.partialyFill()
                if (tradeExecuted === true) await order.fill()
                await this.buyOrderBLService.updateBuyOrder(order)
            }
            return
        }

        // tu: trade execution update
        if (data[1] == 'tu') {
            const teOrder = data[2]
            if (data[2][4] > 0) {
                // {"0":0,"1":"tu",
                // "2":[663580601,"tTESTBTC:TESTUSD",1618090015696,62212773275,0.0034,59127,"EXCHANGE STOP",59042,-1,-0.0000068,"TESTBTC",1618084828860],
                // "context":"not pu","level":"info"}
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

            if (data[2][4] < 0) {
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

    }

    private async checkBuyOrderRules(candle: Candle, tradeSession: TradeSession): Promise<number> {
        if (candle.hasOwnProperty("ma")) {
            if (candle.close > candle.ma) {
                return 0
            }
        }

        const priceDiff = Percentage.diffNumsAsPerc(candle.ma, candle.close)
        if (priceDiff < tradeSession.priceDiff) {
            return 0
        }

        return parseFloat(priceDiff.toFixed(0)) < 1 ? 1 : parseFloat(priceDiff.toFixed(0))
    }
}