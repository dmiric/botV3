import { Injectable } from '@nestjs/common';
import { OrderCycle } from '../interfaces/ordercycle.model';
import { Order } from '../interfaces/order.model'
import { OrderCyclesService } from './ordercycles.service';
import { LogService } from '../log/log.service';

@Injectable()
export class OrderCycleService {

    private buyOrders: Order[] = []
    private sellOrders: Order[] = []
    private totalAmount = 0
    private totalValue = 0
    private currentTimeFrame = ''

    constructor(
        private orderCycles: OrderCyclesService, 
        private logService: LogService
        ) { }

    addBuyOrder(order: Order, price: number): void {
        order.price = price
        //this.buyOrders.push(order)
        this.buyOrders[order.cid] = order
    }

    setCurrentTimeFrame(timeframe: string): void {
        this.currentTimeFrame = timeframe
    }

    getCurrentTimeFrame(): string {
        if(this.currentTimeFrame) {
          return this.currentTimeFrame
        }

        return
    }

    getSellOrder(): Order {
        if (this.sellOrders.length > 0) {
            return this.sellOrders[0]
        }
    }

    getBuyOrders(): Order[] {
        return this.buyOrders
    }

    getNextBuyOrderId(): number {
        if (this.buyOrders.length === 0) {
            return 101 // 101 is always first order
        }

        const potentialOrderId = this.buyOrders[this.buyOrders.length - 1].cid + 1
        if (potentialOrderId > 120) {
            return 0 // no more orders
        }
        return this.buyOrders[this.buyOrders.length - 1].cid + 1
    }

    getLastBuyOrder(): Order {
        return this.buyOrders[this.buyOrders.length - 1]
    }

    getLastUnFilledBuyOrderId(): number {
        if (this.getLastBuyOrder()) {
            const lastBuyOrder = this.getLastBuyOrder()
            if (typeof (lastBuyOrder.status) == 'undefined') {
                return lastBuyOrder.cid
            }
        }

        return 0
    }

    getBuyOrderByCid(cid: number): Order {
        return this.buyOrders[cid]
    }

    buyOrderBought(buyOrder: Order): void {
        buyOrder.status = 'filled'
        this.buyOrders[buyOrder.cid] = buyOrder

        this.setTotalAmount()
        this.setTotalValue()

        this.logService.setData([
            this.totalAmount,
            this.totalValue,
            buyOrder.cid,
            buyOrder.price,
            (buyOrder.price * buyOrder.amount) * 0.001
        ], ['total_amount', 'total_value' ,'bob_cid', 'bob_price', 'bob_fee'])

        this.setSellOrder(buyOrder.symbol)
    }

    sellOrderSold(): void {
        const cycle: OrderCycle = {
            buyOrders: this.buyOrders,
            sellOrder: this.sellOrders[0],
            totalAmount: this.totalAmount,
            totalValue: this.totalValue
        }
        this.orderCycles.addOrderCycle(cycle)

        const buyOrder = this.getLastBuyOrder()

        this.logService.setData([
            this.totalAmount * this.sellOrders[0].price * buyOrder.meta.target,
            (this.sellOrders[0].price * this.totalAmount) * 0.001
        ], ['profit', 'so_fee'])

        this.resetCycle()
    }

    private resetCycle(): void {
        this.buyOrders = []
        this.sellOrders = []
        this.totalAmount = 0
        this.totalValue = 0
    }

    timeFrameChanged(): boolean {
        if(this.buyOrders[this.buyOrders.length - 1].meta.timeframe != this.currentTimeFrame) {
            return true
        }

        return false
    }

    getLastOrderTimeFrame(): string {
        return this.buyOrders[this.buyOrders.length - 1].meta.timeframe
    }

    private setSellOrder(symbol: string) {
        this.sellOrders = []
        this.sellOrders.push({
            cid: Date.now(),
            type: 'LIMIT',
            amount: this.totalAmount, // should be string when sending to bfx
            symbol: symbol,
            price: this.calcSellOrderPrice()
        })
    }

    private setTotalAmount(): void {
        let totalAmount = 0
        for (const buyOrder of this.buyOrders) {
            if (buyOrder) {
                totalAmount = totalAmount + buyOrder.amount
            }
        }
        this.totalAmount = this.round(totalAmount, 10000)
    }

    private setTotalValue(): void {
        let totalValue = 0
        for (const buyOrder of this.buyOrders) {
            if (buyOrder) {
                totalValue = totalValue + (buyOrder.amount * buyOrder.price)
            }
        }
        this.totalValue = this.round(totalValue)
    }

    private calcSellOrderPrice(): number {
        const buyOrder = this.getLastBuyOrder()
        const price = (this.totalValue / this.totalAmount) + ((this.totalValue / this.totalAmount) * buyOrder.meta.target)
        return this.round(price)
    }

    private round(num: number, dec = 1000): number {
        return Math.round((num + Number.EPSILON) * dec) / dec
    }

}
