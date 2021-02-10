import { Injectable, Logger, LoggerService, Inject } from '@nestjs/common'
import { OrdersService } from '../orders/orders.service'
import { Candle } from '../interfaces/candle.model'
import { OrderCycleService } from '../orders/ordercycle.service'
import { TradeSession } from 'src/tradesession/models/tradesession.entity'


@Injectable()
export class BencBehaviourService {

    private candles: Candle[]
    private reach = 0;
    private nextOrder;
    private lowestPrice: number;

    constructor(private ordersService: OrdersService, 
        private ordersCycle: OrderCycleService,
        @Inject(Logger) private readonly logger: LoggerService ) { }

    public getBehaviourInfo(): any {
        return {
            'candles': this.candles ? this.candles : [],
            'maxReach': this.reach,
            'nextOrder': this.nextOrder
        }
    }

    // do this some day if we start working with more behaviours
    // https://stackoverflow.com/questions/53776882/how-to-handle-nestjs-dependency-injection-when-extending-a-class-for-a-service
    public nextOrderIdThatMatchesRules(candles: Candle[], tradeSession: TradeSession): number {

        const candleStack: Candle[] = [];

        for(const c of candles) {
            candleStack.push(c)
        }

        this.candles = candleStack

        const nextOrderId = this.ordersCycle.getNextBuyOrderId(tradeSession)
        // in case this is the first order return it right away
        if (nextOrderId === 101) {
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

        // if we have only 1 candle no need to check for other conditions
        if (candles.length < 2) {
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
        const nextOrder = this.ordersService.getOrder(tradeSession, nextOrderId, lowestPrice)
        this.nextOrder = { ...nextOrder }
        // if order is other than frist one check if currentPrice is low enough
        if (this.isPriceLowEnough(tradeSession, lowestPrice)) {
            this.reach = 6;
            return nextOrder.meta.id
        }

        // if all else fails return 0
        return 0
    }

    getBuyOrderPrice(candles: Candle[]): number {
        return this.findLowestPrice(candles, 'low')
    }

    private isPriceLowEnough(tradeSession: TradeSession, lowestPrice: number): boolean {
        const lastOrder = this.ordersCycle.getLastBuyOrder(tradeSession)
        const conditionPrice: number = lastOrder.price - (lastOrder.price * tradeSession.safeDistance / 100)

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
