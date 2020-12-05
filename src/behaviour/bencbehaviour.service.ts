import { Injectable } from '@nestjs/common'
import { OrdersService } from '../orders/orders.service'
import { Candle } from '../interfaces/candle.model'
import { Order } from '../interfaces/order.model'
import { OrderCycleService } from '../orders/ordercycle.service'

@Injectable()
export class BencBehaviourService {

    constructor(private ordersService: OrdersService, private ordersCycle: OrderCycleService) { }

    // do this some day if we start working with more indicators
    // https://stackoverflow.com/questions/53776882/how-to-handle-nestjs-dependency-injection-when-extending-a-class-for-a-service
    public nextOrderIdThatMatchesRules(candles: Candle[]): number {

        const nextOrderId = this.ordersCycle.getNextBuyOrderId()
        // in case this is the first order return it right away
        if (nextOrderId === 101) {
            return nextOrderId
        }

        // find next order
        if(nextOrderId === 0) {
            return 0
        }

        // check if last candle is green
        const lastCandle: Candle = candles[candles.length - 1]
        if (!this.isGreen(lastCandle)) {
            return 0
        }

        // if we have only 1 candle no need to check for other conditions
        if (candles.length < 2) {
            return 0
        }

        // if candle before last is not red no need to continue
        const candleBeforeLast: Candle = candles[candles.length - 2]
        if (!this.isRed(candleBeforeLast)) {
            return 0
        }

        // get stack of candles to run a price check on
        //const candleStack = this.getCandleStack(candles, lastCandle)
        const candleStack = candles;
        // find lowest low price in candle stack
        const currentPrice = this.findLowestPrice(candleStack, 'low')
        const nextOrder = this.ordersService.getOrder(nextOrderId)
        // if order is other than frist one check if currentPrice is low enough
        if (this.isPriceLowEnough(currentPrice)) {
            return nextOrder.cid
        }

        // if all else fails return 0
        return 0
    }

    getBuyOrderPrice(candles: Candle[]): number {
        return this.findLowestPrice(candles, 'low')
    }

    private isPriceLowEnough(price: number): boolean {
        const lastOrder = this.ordersCycle.getLastBuyOrder()
        const conditionPrice: number = lastOrder.price - (lastOrder.price * lastOrder.meta.safeDistance)

        if (price < conditionPrice) {
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

    public getCandleStack(candles: Candle[], lastCandle: Candle): Candle[] {
        const reversedCandles = candles.reverse()
        const candleStack: Candle[] = []

        for (const candle of reversedCandles) {
            // always take frist green candle
            if (lastCandle.mts === candle.mts) {
                candleStack.push(candle)
                continue
            }
            // if any other green candle stop looking for more
            if (this.isGreen(candle)) {
                break
            }
            // add red candle to the stack
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
