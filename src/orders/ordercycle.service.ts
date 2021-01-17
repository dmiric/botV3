import { Injectable, Inject, Logger, LoggerService } from '@nestjs/common'
import { Order } from '../interfaces/order.model'
import { Key } from '../interfaces/key.model'

@Injectable()
export class OrderCycleService {

    private buyOrders: Order[] = []
    private sellOrders: Order[] = []
    private totalAmount = {}
    private totalValue = {}
    private currentTimeFrame = {}
    private currentBalance = {}

    constructor(
        @Inject(Logger) private readonly logger: LoggerService
    ) { }

    getStatus() {
        const status = {
            "buyOrders": { ...this.buyOrders }
        }

        return status;
    }

    setCurrentBalance(key: Key, change = 0): void {
        // set initial balance
        if (!(key.id in this.currentBalance) && change === 0) {
            this.currentBalance[key.id] = key.startBalance
        }

        if (key.id in this.currentBalance && change !== 0) {
            this.currentBalance[key.id] = this.currentBalance[key.id] + change
        }
    }

    addBuyOrder(key: Key, order: Order, price: number): void {
        const o = { ...order }
        o.price = price

        if(!(key.id in this.buyOrders)) {
            this.buyOrders[key.id] = []
        }
        this.buyOrders[key.id].push(o)
    }

    updateBuyOrder(key: Key, cid: number, data: any): void {
        const o = this.getBuyOrderByCid(key, cid)
        if(data.hasOwnProperty('price')) {
            o.price = data.price
        }
        if(data.hasOwnProperty('tradeExecuted')) {
            o.meta.tradeExecuted = data.tradeExecuted
        }
        if(data.hasOwnProperty('ex_id')) {
            o.meta.ex_id = data.ex_id
        }
    }

    setCurrentTimeFrame(key: Key): void {
        this.currentTimeFrame[key.id] = key.timeframe
    }

    getCurrentTimeFrame(key: Key): string {
        if (this.currentTimeFrame && this.currentTimeFrame[key.id]) {
            return this.currentTimeFrame[key.id]
        }

        return
    }

    getSellOrder(key: Key): Order {
        if (key.id in this.sellOrders) {
            return this.sellOrders[key.id][0]
        }
    }

    getBuyOrders(key: Key): Order[] {
        return this.buyOrders[key.id]
    }

    getNextBuyOrderId(key: Key): number {
        if (!(key.id in this.buyOrders) || this.buyOrders[key.id].length < 1) {
            return 101 // 101 is always first order
        }

        const potentialOrderId = this.buyOrders[key.id][this.buyOrders[key.id].length - 1].meta.id + 1
        if (potentialOrderId > 120) {
            return 0 // no more orders
        }
        return potentialOrderId
    }

    getLastBuyOrder(key: Key): Order {
        if (key.id in this.buyOrders) {
            return this.buyOrders[key.id][this.buyOrders[key.id].length - 1]
        }
    }

    getLastUnFilledBuyOrderId(key: Key): number {
        const lastBuyOrder = this.getLastBuyOrder(key)
        if (lastBuyOrder) {
            if (lastBuyOrder.meta.tradeExecuted === false) {
                return lastBuyOrder.meta.id
            }
        }

        return 0
    }

    getBuyOrderByCid(key: Key, cid: number): Order {
        for (const order of this.buyOrders[key.id]) {
            if(order.cid === cid) {
                return order
            }
        }
    }

    buyOrderBought(key: Key, buyOrder: Order): void {
        buyOrder.status = 'filled'
        this.buyOrders[key.id][buyOrder.cid] = buyOrder

        this.setTotalAmount(key)
        this.setTotalValue(key)

        // set balance
        const val = buyOrder.amount * buyOrder.price
        this.setCurrentBalance(key, (val - val * 2))
        /*
        this.logService.setData(key, [
            this.currentBalance[key.id]
        ], ['balance'])
        */

        /*
        this.logService.setData(key, [
            this.totalAmount[key.id],
            this.totalValue[key.id],
            buyOrder.cid,
            buyOrder.price,
            (buyOrder.price * buyOrder.amount) * 0.001
        ], ['total_amount', 'total_value', 'bob_cid', 'bob_price', 'bob_fee'])
        */

        this.setSellOrder(key, buyOrder.symbol)
    }

    setSellOrderTrailingPrice(key: Key, trailingPrice: number): void {
        this.sellOrders[key.id][0].meta.trailingPrice = trailingPrice;
    }

    sellOrderSold(key: Key, price: number): void {
        /*
        const cycle: OrderCycle = {
            buyOrders: this.buyOrders[key.id],
            sellOrder: this.sellOrders[key.id][0],
            totalAmount: this.totalAmount[key.id],
            totalValue: this.totalValue[key.id]
        }
        this.orderCycles.addOrderCycle(key, cycle)
        */

        const buyOrder = this.getLastBuyOrder(key)

        /*
        this.logService.setData(key, [
            this.totalAmount[key.id] * price * buyOrder.meta.target,
            (price * this.totalAmount[key.id]) * 0.001
        ], ['profit', 'so_fee'])
        */

        this.setCurrentBalance(key, price * this.sellOrders[key.id][0].amount)
        /*
        this.logService.setData(key, [
            this.currentBalance[key.id]
        ], ['balance'])
        */

        this.resetCycle(key)
    }

    public finishOrderCycle(key: Key): void {
        this.buyOrders = []
        this.sellOrders = []
        this.totalAmount = []
        this.totalValue = []    
    }

    private resetCycle(key: Key): void {
        this.buyOrders[key.id] = []
        this.sellOrders[key.id] = []
        this.totalAmount[key.id] = 0
        this.totalValue[key.id] = 0
    }

    timeFrameChanged(key: Key): boolean {
        if (this.buyOrders[key.id][this.buyOrders[key.id].length - 1].meta.timeframe != this.currentTimeFrame[key.id]) {
            return true
        }

        return false
    }

    getLastOrderTimeFrame(key: Key): string {
        return this.buyOrders[key.id][this.buyOrders.length - 1].meta.timeframe
    }

    private setSellOrder(key: Key, symbol: string) {
        this.sellOrders[key.id] = []
        this.sellOrders[key.id].push({
            cid: Date.now(),
            type: 'LIMIT',
            amount: this.totalAmount[key.id], // should be string when sending to bfx
            symbol: symbol,
            price: this.calcSellOrderPrice(key),
            meta: { trailingPrice: 0 }  
        })
    }

    private setTotalAmount(key: Key): void {
        let totalAmount = 0
        for (const buyOrder of this.buyOrders[key.id]) {
            if (buyOrder) {
                totalAmount = totalAmount + buyOrder.amount
            }
        }
        this.totalAmount[key.id] = this.round(totalAmount, 10000)
    }

    private setTotalValue(key: Key): void {
        let totalValue = 0
        for (const buyOrder of this.buyOrders[key.id]) {
            if (buyOrder) {
                totalValue = totalValue + (buyOrder.amount * buyOrder.price)
            }
        }
        this.totalValue[key.id] = this.round(totalValue)
    }

    private calcSellOrderPrice(key: Key): number {
        const buyOrder = this.getLastBuyOrder(key)
        const price = (this.totalValue[key.id] / this.totalAmount[key.id]) + ((this.totalValue[key.id] / this.totalAmount[key.id]) * buyOrder.meta.target)
        return this.round(price)
    }

    private round(num: number, dec = 1000): number {
        return Math.round((num + Number.EPSILON) * dec) / dec
    }

}
