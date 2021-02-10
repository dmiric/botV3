import { Injectable, Inject, Logger, LoggerService } from '@nestjs/common'
import { Order } from '../interfaces/order.model'
import { Key } from '../interfaces/key.model'
import { TradeSession } from '../tradesession/models/tradesession.entity'

@Injectable()
export class OrderCycleService {

    private buyOrders: Order[][]
    private sellOrders: Order[][]
    private totalAmount = {}
    private totalValue = {}
    private currentTimeFrame = {}
    private currentBalance = {}

    constructor(
        @Inject(Logger) private readonly logger: LoggerService
    ) { }

    addBuyOrder(tradeSession: TradeSession, order: Order, price: number): void {
        const o = { ...order }
        
        if(order.meta.id > 101) {
            o.price = price
        }

        if (!this.buyOrders.hasOwnProperty(tradeSession.id) ) {
            this.buyOrders[tradeSession.id] = []
        }
        this.buyOrders[tradeSession.id].push(o)
        this.logger.log(tradeSession, 'addBuyOrder: 27')
    }
    
    updateBuyOrder(tradeSession: TradeSession, cid: number, data: any): void {
        // TODO: devide this in to updateBuyOrder and updateBuyOrderMeta
        const o = this.getBuyOrderByCid(tradeSession, cid)
        if (data.hasOwnProperty('price')) {
            o.price = data.price
        }
        if (data.hasOwnProperty('tradeExecuted')) {
            o.meta.tradeExecuted = data.tradeExecuted
        }
        if (data.hasOwnProperty('ex_id')) {
            o.meta.ex_id = data.ex_id
        }
        if (data.hasOwnProperty('tradeTimestamp')) {
            o.meta.tradeTimestamp = data.tradeTimestamp
        }
        if(data.hasOwnProperty('sentToEx')) {
            o.meta.sentToEx = data.sentToEx
        }
        if(data.hasOwnProperty('exAmount')) {
            o.meta.exAmount = data.exAmount
        }
    }

    setCurrentTimeFrame(tradeSession: TradeSession): void {
        this.currentTimeFrame[tradeSession.id] = tradeSession.timeframe
    }

    getCurrentTimeFrame(tradeSession: TradeSession): string {
        if (this.currentTimeFrame && this.currentTimeFrame[tradeSession.id]) {
            return this.currentTimeFrame[tradeSession.id]
        }

        return
    }

    getSellOrder(key: Key): Order {
        if (key.id in this.sellOrders) {
            return this.sellOrders[key.id][0]
        }
    }

    getBuyOrders(tradeSession: TradeSession): Order[] {
        return this.buyOrders[tradeSession.id]
    }

    getNextBuyOrderId(tradeSession: TradeSession): number {
        if (!this.buyOrders.hasOwnProperty(tradeSession.id) || this.buyOrders[tradeSession.id].length < 1) {
            this.logger.log(tradeSession, "getNextBuyOrderId:67")
            return 101 // 101 is always first order
        }

        const potentialOrderId = this.buyOrders[tradeSession.id][this.buyOrders[tradeSession.id].length - 1].meta.id + 1
        if (potentialOrderId > 120) {
            return 0 // no more orders
        }
        return potentialOrderId
    }

    getLastBuyOrder(tradeSession: TradeSession): Order {
        if (this.buyOrders.hasOwnProperty(tradeSession.id)) {
            if (this.buyOrders[tradeSession.id].length && this.buyOrders[tradeSession.id].length > 0) {
                return this.buyOrders[tradeSession.id][this.buyOrders[tradeSession.id].length - 1]
            }
        }
    }

    getLastUnFilledBuyOrderId(tradeSession: TradeSession): number {
        const lastBuyOrder = this.getLastBuyOrder(tradeSession)
        if (lastBuyOrder) {
            if (lastBuyOrder.meta.tradeExecuted === false) {
                return lastBuyOrder.meta.id
            }
        }

        return 0
    }

    getBuyOrderByCid(tradeSession: TradeSession, cid: number): Order {
        this.logger.log(this.buyOrders, "buy orders")
        for (const order of this.buyOrders[tradeSession.id]) {
            if (order.cid === cid) {
                return order
            }
        }
    }


    // old code not used here anymore    
    setCurrentBalance(key: Key, change = 0): void {
        // set initial balance
        if (!this.currentBalance.hasOwnProperty(key.id) && change === 0) {
            this.currentBalance[key.id] = key.startBalance
        }

        if (this.currentBalance.hasOwnProperty(key.id)&& change !== 0) {
            this.currentBalance[key.id] = this.currentBalance[key.id] + change
        }
    }

    public finishOrderCycle(tradeSession: TradeSession): void {
        this.buyOrders = []
        this.sellOrders = []
        this.totalAmount = []
        this.totalValue = []
    }

}
