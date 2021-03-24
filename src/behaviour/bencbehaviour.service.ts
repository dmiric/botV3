import { Injectable, Logger, LoggerService, Inject } from '@nestjs/common'
import { Candle } from '../interfaces/candle.model'
import { TradeSession } from '../tradesession/models/tradesession.entity'
import { BuyOrder } from '../order/models/buyOrder.entity'
import { TradeSystemRulesService } from 'src/tradesystem/tradesystem.rules.service'


@Injectable()
export class BencBehaviourService {

    private reach = 0;
    private nextOrder;
    private lowestPrice: number;

    constructor(
        private tradeSystemRules: TradeSystemRulesService,
        @Inject(Logger) private readonly logger: LoggerService ) { }

    public getBehaviourInfo(): any {
        return {
            'maxReach': this.reach,
            'nextOrder': this.nextOrder
        }
    }

    // do this some day if we start working with more behaviours
    // https://stackoverflow.com/questions/53776882/how-to-handle-nestjs-dependency-injection-when-extending-a-class-for-a-service
    async nextTradeSystemGroupThatMatchesRules(candleStack: Candle[], tradeSession: TradeSession, lastBuyOrder: BuyOrder): Promise<number> {

        const nextOrderId = await this.tradeSystemRules.getNextTradeSystemGroup(tradeSession, lastBuyOrder.tradeSystemGroup)
        // in case this is the first order return it right away
        if (nextOrderId == 1) {
            this.logger.log(tradeSession, "nextOrderIdThatMatchesRules:45")
            this.reach = 1;
            return nextOrderId
        }

        // check if last candle is green
        
        const lastCandle: Candle = candleStack[candleStack.length - 1]
        if (!this.isGreen(lastCandle)) {
            this.reach = 3;
            return 0
        }
        
        /*
        if(!this.areGreen(candleStack, 1)) {
            this.reach = 3;
            return 0
        }
        */

        // if we have only 1 candle no need to check for other conditions
        if (candleStack.length < 2) {
            this.reach = 4;
            return 0
        }

        // if candle before last is not red no need to continue
        const candleBeforeLast: Candle = candleStack[candleStack.length - 2]
        if (!this.isRed(candleBeforeLast)) {
            this.reach = 5;
            return 0
        }

        // find lowest low price in candle stack
        const lowestPrice = this.findLowestPrice(candleStack, 'low')
        // if order is other than frist one check if currentPrice is low enough
        if (this.isPriceLowEnough(tradeSession, lowestPrice, lastBuyOrder)) {
            this.reach = 6;
            return nextOrderId
        }

        // if all else fails return 0
        return 0
    }

    getBuyOrderPrice(candles: Candle[]): number {
        return this.findLowestPrice(candles, 'low')
    }

    private isPriceLowEnough(tradeSession: TradeSession, lowestPrice: number, lastBuyOrder: BuyOrder): boolean {
        const conditionPrice: number = lastBuyOrder.price - (lastBuyOrder.price * tradeSession.safeDistance / 100)
        console.log("Is Price Low Enough: " + lowestPrice + ":" + conditionPrice)

        if (lowestPrice < conditionPrice) {
            return true
        }

        return false
    }

    private isGreen(candle: Candle): boolean {
        if (candle.open < candle.close) {
            return true
        }
        return false
    }

    private areGreen(candleStack: Candle[], candleNum: number): boolean {
        for (let i = 1; i <= candleNum; i++) {
            const lastCandle = candleStack[candleStack.length - i]
            if(!this.isGreen(lastCandle)) {
                return false
            }
        }
        return true
    }

    private isRed(candle: Candle): boolean {
        if (candle.open > candle.close) {
            return true
        }
        return false
    }

    public getCandleStack(candles: Candle[], tradeTimestamp: number): Candle[] {
        const candleStack: Candle[] = []
        for (const candle of candles) {
            if (candle.mts < tradeTimestamp) {
                break
            }
            candleStack.push(candle)
        }
        return candleStack.reverse()
    }

    private findLowestPrice(candles: Candle[], priceLabel: string): number {
        let lowestPrice = candles[0].low
        for (const candle of candles) {
            if (candle[priceLabel] < lowestPrice) {
                lowestPrice = candle[priceLabel]
            }
        }
        return lowestPrice
    }

}
