import { Injectable, Logger, LoggerService, Inject } from '@nestjs/common'
import { Candle } from '../interfaces/candle.model'
import { TradeSession } from '../tradesession/models/tradesession.entity'
import { BuyOrder } from '../order/models/buyOrder.entity'


@Injectable()
export class BehaviourTwoService {

    constructor(@Inject(Logger) private readonly logger: LoggerService) { }

    // do this some day if we start working with more behaviours
    // https://stackoverflow.com/questions/53776882/how-to-handle-nestjs-dependency-injection-when-extending-a-class-for-a-service
    async checkCompletedCandles(lastCandle: Candle, tradeSession: TradeSession): Promise<number> {
        // if candle before last is not red no need to continue
        if (!this.isRed(lastCandle)) {
            return 0
        }

        const priceDiff = this.priceDiff(lastCandle)        
        if (priceDiff < tradeSession.priceDiff) {
            return 0
        }

        return parseFloat(priceDiff.toFixed(0))
    }

    async checkTicks(lastCandle: Candle, tradeSession: TradeSession): Promise<number> {
        if(!tradeSession.priceDiffLow) {
            return
        }

        const priceDiff = this.priceDiff(lastCandle, 'low')
        const roundPriceDiff = parseFloat(priceDiff.toFixed(0))
        const priceDiffLow = JSON.parse(tradeSession.priceDiffLow)
        if(roundPriceDiff >= priceDiffLow.low) {
            return priceDiffLow.low
        }

        return 0
    }

    getTrailingOrderPrices(tradeSession: TradeSession, bo: BuyOrder): number[] {
        if (tradeSession.originalTrailingProfit != null && tradeSession.originalTrailingDistance != null) {
            let trailingProfit = tradeSession.originalTrailingProfit;
            let trailingDistance = tradeSession.originalTrailingDistance;

            if (tradeSession.overrideTrailingProfit !== null && tradeSession.overrideTrailingDistance !== null) {
                trailingProfit = tradeSession.overrideTrailingProfit
                trailingDistance = tradeSession.overrideTrailingDistance
            }

            const sellOrderTargetPrice = (bo.tradeSystemGroup * trailingProfit / 10000) + bo.price
            const priceTrailing = sellOrderTargetPrice * (trailingDistance / 100)

            return [sellOrderTargetPrice, priceTrailing]
        }
    }

    private isPriceLowEnough(tradeSession: TradeSession, lowestPrice: number, lastBuyOrder: BuyOrder): boolean {
        const price = lastBuyOrder.price ? lastBuyOrder.price : lastBuyOrder.candleClose
        const conditionPrice: number = price - (price * tradeSession.safeDistance / 100)
        console.log("Is Price Low Enough: " + lowestPrice + ":" + conditionPrice)

        if (lowestPrice < conditionPrice) {
            return true
        }

        return false
    }

    private isRed(candle: Candle): boolean {
        if (candle.open > candle.close) {
            return true
        }
        return false
    }

    public priceDiff(candle: Candle, pricePoint = 'close'): number {
        if (candle.open <= candle[pricePoint]) {
            return
        }

        const diff = candle.open - candle[pricePoint]
        return diff / candle.open * 100
    }

}
