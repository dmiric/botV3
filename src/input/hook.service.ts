import { Injectable } from '@nestjs/common'
import { TradeService } from '../exchange/trade.service'
import { HookReqDto } from './dto/HookReqDto'
import { Key } from '../interfaces/key.model'

@Injectable()
export class HookService {

    constructor(private tradeService: TradeService) { }

    start(req: HookReqDto): void {
        let key: Key

        if (!this.validate(req)) {
            return
        }

        if (req.action === 'close') {
            key = {
                id: 'id' + Math.floor(Math.random() * (999999999 + 1) + 0),
                action: req.action,
                symbol: req.symbol,
                trade: "trade"
            }

            this.tradeService.closePosition(key)
            return
        }

        if (this.tradeService.getStatus() || this.tradeService.isStopped() || this.tradeService.isStarting()) {
            console.log("already active")
            return
        }

        if (req.action == 'long') {
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

            if(req.hasOwnProperty("priceTrailing")) {
                key["trailingProfit"] = req.priceTrailing.profit
                key["trailingDistance"] = req.priceTrailing.distance
            }

            this.tradeService.trade(key)
        }

        if(!this.tradeService.getManualPosition()) {
            return
        }

        if (req.action == 'trail') {
            key = {
                action: req.action,
                symbol: req.symbol,
                trade: "trade"
            }

            if(req.hasOwnProperty("priceTrailing")) {
                key["trailingProfit"] = req.priceTrailing.profit
                key["trailingDistance"] = req.priceTrailing.distance
            }

            this.tradeService.trade(key, true)
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

        if (req.action === 'long') {
            if (!req.hasOwnProperty('startBalance') || req.startBalance < 1) {
                console.log("Missing startBalance param.")
                return false
            }

            if (!req.hasOwnProperty('safeDistance') || (req.safeDistance < 0 && req.safeDistance > 100)) {
                console.log("Missing or incorrect safeDistance param.")
                return false
            }

            if(req.hasOwnProperty("priceTrailing")) {
                const priceTrailing = req.priceTrailing;
                if(!priceTrailing.hasOwnProperty('profit')) {
                    return false
                }
                if(!priceTrailing.hasOwnProperty('distance')) {
                    return false
                }
            }
        }

        if (req.action === 'trail') {
            if(req.hasOwnProperty("priceTrailing")) {
                const priceTrailing = req.priceTrailing;
                if(!priceTrailing.hasOwnProperty('profit')) {
                    return false
                }
                if(!priceTrailing.hasOwnProperty('distance')) {
                    return false
                }
            }
        }

        return true
    }

}
