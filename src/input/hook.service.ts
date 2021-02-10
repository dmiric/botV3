import { Injectable } from '@nestjs/common'
import { TradeService } from '../exchange/trade.service'
import { HookReqDto } from './dto/HookReqDto'
import { Key } from '../interfaces/key.model'
import { TrailingStop } from '../interfaces/trailingstop.model'
import { TradeSessionService } from '../tradesession/tradesession.service'
import { TradeSession } from 'src/tradesession/models/tradesession.entity'

@Injectable()
export class HookService {

    constructor(private tradeService: TradeService, private tradeSession: TradeSessionService) { }

    async start(req: HookReqDto): Promise <void> {
        let key: Key

        if (!this.validate(req)) {
            return
        }

        switch (req.action) {
            case 'close':
                key = {
                    id: 'id' + Math.floor(Math.random() * (999999999 + 1) + 0),
                    action: req.action,
                    symbol: req.symbol,
                    trade: "trade",
                    closePercent: req.closePercent
                }

                this.tradeService.closePosition(key)
                break;
            case 'long':
                if (this.tradeService.getStatus() || this.tradeService.isStopped() || this.tradeService.isStarting()) {
                    console.log("already active")
                    return
                }

                if (this.tradeService.getManualPosition()) {
                    console.log("already active - manual position")
                    return
                }

                key = {
                    id: 'id' + Math.floor(Math.random() * (999999999 + 1) + 0),
                    action: req.action,
                    symbol: req.symbol,
                    logDates: [],
                    trade: "trade",
                    timeframe: req.timeframe, // should be first order timeframe
                    startBalance: req.startBalance,
                    safeDistance: req.safeDistance
                }

                const tradeSession: TradeSession = {
                    symbol: req.symbol,
                    startTime: new Date(),
                    timeframe: req.timeframe,
                    startBalance: req.startBalance,
                    safeDistance: req.safeDistance,
                    status: 'starting'
                }
                
                if (req.hasOwnProperty("priceTrailing")) {
                    tradeSession.originalTrailingProfit = req.priceTrailing.profit
                    tradeSession.originalTrailingDistance = req.priceTrailing.distance
                }


                if (req.hasOwnProperty("priceTrailing")) {
                    key["trailingProfit"] = req.priceTrailing.profit
                    key["trailingDistance"] = req.priceTrailing.distance
                }

                const trade = await this.tradeSession.create(tradeSession)
                this.tradeService.trade(key)
                break;
            case 'trail':
                if (this.tradeService.getManualPosition()) {
                    key = {
                        action: req.action,
                        symbol: req.symbol,
                        trade: "trade"
                    }

                    if (req.hasOwnProperty("priceTrailing")) {
                        key["trailingProfit"] = req.priceTrailing.profit
                        key["trailingDistance"] = req.priceTrailing.distance
                    }

                    this.tradeService.trade(key, true)
                } else {
                    if (req.hasOwnProperty("priceTrailing")) {
                        const trail: TrailingStop = {}
                        trail.trailingProfit = req.priceTrailing.profit
                        trail.trailingDistance = req.priceTrailing.distance
                        this.tradeService.setManualTrailingStop(trail)
                    }
                }
                break;
        }
    }

    validate(req: HookReqDto): boolean {
        if (req.action !== 'long' && req.action !== 'close' && req.action !== 'trail') {
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

        if (req.action === 'close') {
            if (!req.hasOwnProperty('closePercent')) {
                console.log("Missing closePercent param.")
                return false
            }

        }

        if (req.action === 'long') {
            if (!req.hasOwnProperty('startBalance') || req.startBalance < 1) {
                console.log("Missing startBalance param.")
                return false
            }

            if (!req.hasOwnProperty('safeDistance') || (req.safeDistance < 0 && req.safeDistance > 100)) {
                console.log("Missing or incorrect safeDistance param.")
                return false
            }

            if (req.hasOwnProperty("priceTrailing")) {
                const priceTrailing = req.priceTrailing;
                if (!priceTrailing.hasOwnProperty('profit')) {
                    return false
                }
                if (!priceTrailing.hasOwnProperty('distance')) {
                    return false
                }
            }
        }

        if (req.action === 'trail') {
            if (req.hasOwnProperty("priceTrailing")) {
                const priceTrailing = req.priceTrailing;
                if (!priceTrailing.hasOwnProperty('profit')) {
                    return false
                }
                if (!priceTrailing.hasOwnProperty('distance')) {
                    return false
                }
            }
        }

        return true
    }

}
