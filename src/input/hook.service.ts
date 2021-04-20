import { Injectable } from '@nestjs/common'
import { TradeService } from '../exchange/trade.service'
import { HookReqDto } from './dto/HookReqDto'
import { TradeSessionBLService } from '../tradesession/tradesession.bl.service'
import { TradeSession } from '../tradesession/models/tradesession.entity'
import { TradeSystemRulesService } from '../tradesystem/tradesystem.rules.service'

@Injectable()
export class HookService {

    constructor(
        private readonly tradeService: TradeService,
        private readonly tradeSessionBLService: TradeSessionBLService,
        private readonly tradeSystemRules: TradeSystemRulesService) { }

    async newLong(req: HookReqDto): Promise<void> {
        if (!this.validate(req)) {
            return
        }

        if (this.tradeService.getStatus() || this.tradeService.isStopped() || this.tradeService.isStarting()) {
            console.log("already active")
            return
        }

        // refactor this to new TradeSession from req?
        const buyRules = await this.tradeSystemRules.findByIds([req.buy.buyRules])
        const sellRules = await this.tradeSystemRules.findByIds([req.sell.sellRules])
        let salesRules = null
        if (req.sell.salesRules) {
            salesRules = await this.tradeSystemRules.findByIds(req.sell.salesRules)
        }

        let startTime = null
        if (req.startTime) {
            const reqST = req.startTime.split("-")
            startTime = new Date(Date.UTC(parseInt(reqST[2]), parseInt(reqST[1]) - 1, parseInt(reqST[0])))
        }

        const newTradeSession: TradeSession = {
            symbol: req.symbol,
            startTime: startTime ? startTime : Date.now(),
            timeframe: req.timeframe,
            startBalance: req.buy.startBalance,
            safeDistance: req.buy.safeDistance,
            status: 'new',
            originalTrailingDistance: req.sell.trailingDistance ? req.sell.trailingDistance : null,
            buyTrailingDistance: req.buy.trailingDistance ? req.buy.trailingDistance : null,
            buyRules: buyRules[0],
            sellRules: sellRules[0],
            strategy: req.strategy,
            priceDiff: req.buy.priceDiff ? req.buy.priceDiff : null,
            priceDiffLow: req.buy.priceDiffLow ? JSON.stringify(req.buy.priceDiffLow) : null,
            exchange: req.exchange,
            ma: req.buy.ma ? req.buy.ma : null
        }

        if (salesRules != null) {
            newTradeSession.salesRules = salesRules
        }

        let endTime = null
        if (req.endTime) {
            const reqST = req.endTime.split("-")
            endTime = new Date(Date.UTC(parseInt(reqST[2]), parseInt(reqST[1]) - 1, parseInt(reqST[0])))
            newTradeSession.endTime = endTime ? endTime : Date.now()
        }

        if (req.buy.investment) {
            newTradeSession.investment = req.buy.investment
        }

        const tS = await this.tradeSessionBLService.create(newTradeSession)
        tS.init()
        await this.tradeService.trade(tS)
    }

    async updateLong(req: HookReqDto): Promise<void> {
        if (!this.validate(req)) {
            return
        }

        const tradeSession = await this.tradeSessionBLService.findLastActive()

        if (req.hasOwnProperty('timeframe')) {
            tradeSession.timeframe = req.timeframe
        }

        if (req.hasOwnProperty('buy')) {
            const buy = req.buy

            if (buy.hasOwnProperty('startBalance')) {
                tradeSession.startBalance = buy.startBalance
            }

            if (buy.hasOwnProperty('safeDistance')) {
                tradeSession.safeDistance = buy.safeDistance
            }

            if (buy.hasOwnProperty('priceDiff')) {
                tradeSession.priceDiff = buy.priceDiff
            }

            if (buy.hasOwnProperty('trailingDistance')) {
                tradeSession.buyTrailingDistance = req.buy.trailingDistance
            }

            if (buy.hasOwnProperty('priceDiffLow')) {
                tradeSession.priceDiffLow = JSON.stringify(buy.priceDiffLow)
            }

            if (buy.hasOwnProperty('investment')) {
                tradeSession.investment = buy.investment
            }

            if (buy.hasOwnProperty('ma')) {
                tradeSession.ma = buy.ma
            }

            if (buy.hasOwnProperty('buyRules')) {
                const buyRules = await this.tradeSystemRules.findByIds([buy.buyRules])
                tradeSession.buyRules = buyRules[0]
            }
        }

        if (req.hasOwnProperty('sell')) {
            const sell = req.sell

            if (sell.hasOwnProperty('trailingDistance')) {
                tradeSession.overrideTrailingDistance = req.sell.trailingDistance
            }

            // test

            if (sell.hasOwnProperty('sellRules')) {
                const sellRules = await this.tradeSystemRules.findByIds([sell.sellRules])
                tradeSession.sellRules = sellRules[0]
            }

            if (sell.hasOwnProperty('salesRules')) {
                let salesRules = null
                if (req.sell.salesRules) {
                    salesRules = await this.tradeSystemRules.findByIds(req.sell.salesRules)
                }
                tradeSession.salesRules = salesRules
            }
        }

        await this.tradeSessionBLService.save(tradeSession)
        this.tradeService.setActiveTradeSession(tradeSession)
    }

    validate(req: HookReqDto): boolean {
        if (req.action !== 'long') {
            console.log("Incorrect action param.")
            return false
        }

        if (!req.hasOwnProperty('action')) {
            console.log("Missing an action param.")
            return false
        }

        if (!req.hasOwnProperty('symbol')) {
            console.log("Missing a symbol param.")
            return false
        }

        if (req.action === 'long') {
            if (!req.hasOwnProperty('buy')) {
                console.log("Missing buy params.")
                return false
            }

            if (!req.buy.hasOwnProperty('buyRules')) {
                console.log("Missing buy rules.")
                return false
            }

            if (!req.hasOwnProperty('sell')) {
                console.log("Missing sell params.")
                return false
            }

            if (!req.sell.hasOwnProperty('sellRules')) {
                console.log("Missing sell rules.")
                return false
            }

            if (!req.buy.hasOwnProperty('startBalance') || req.buy.startBalance < 1) {
                console.log("Missing startBalance param.")
                return false
            }

            if (req.buy.hasOwnProperty('safeDistance') && (req.buy.safeDistance < 0 && req.buy.safeDistance > 100)) {
                console.log("Incorrect safeDistance param.")
                return false
            }

        }
        return true
    }

}
