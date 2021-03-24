import { Injectable } from '@nestjs/common'
import { TradeSession } from 'src/tradesession/models/tradesession.entity'
import { QueryBuilder, UpdateResult } from 'typeorm'
import { SellOrderService } from './sellorder.service'
import { SellOrder } from './models/sellOrder.entity'

@Injectable()
export class SellOrderBLService {

    private busy = {
        tradeSession: 0
    }

    constructor(private sellOrderDb: SellOrderService) { }

    async createSellOrder(tradeSession: TradeSession, type: string, amount: number, price?: number, trailingPrice?: number): Promise<SellOrder> {
        this.busy = {
            tradeSession: tradeSession.id
        }

        const sellOrderData: SellOrder = {
            gid: tradeSession.id,
            cid: Date.now(),
            type: type,
            amount: amount - (2 * amount),
            symbol: tradeSession.symbol,
            source: 'bot',
            status: 'new'
        }

        if(price && price > 0) {
            sellOrderData.price = price
        }

        if (type == 'TRAILING STOP' || type == 'EXCHANGE TRAILING STOP') {
            sellOrderData.priceTrailing = trailingPrice
        }

        // we dont set the price so we can use order for market and limit order
        const sellOrder = await this.sellOrderDb.create(sellOrderData)
        const so = await this.sellOrderDb.findByIds([sellOrder.id])
        return so[0]
    }

    getQueryBuilder(): QueryBuilder<SellOrder> {
        return this.sellOrderDb.getQueryBuilder()
    }

    async getSellOrders(tradeSession: TradeSession): Promise<SellOrder[]> {
        const sellOrders = await this.sellOrderDb.find({ where: { gid: tradeSession.id } })
        return sellOrders
    }

    async findByIds(ids: number[]): Promise<SellOrder[]> {
        const sellOrders = await this.sellOrderDb.findByIds(ids)
        return sellOrders
    }

    async findSellOrderByCid(tradeSession: TradeSession, cid: number): Promise<SellOrder> {
        const sellOrders = await this.sellOrderDb.find({ where: { gid: tradeSession.id, cid: cid } })
        return sellOrders[0]
    }

    async updateSellOrder(sellOrder: SellOrder): Promise<UpdateResult> {
        return await this.sellOrderDb.update(sellOrder)
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    async addCustomSellOrder(tradeSession: TradeSession, order: any): Promise<SellOrder> {
        const o = this.formatOrder(tradeSession, order)

        if (await this.findSellOrderByCid(tradeSession, o.cid)) {
            return
        }

        const sellOrder = await this.sellOrderDb.create(o)
        const bo = await this.sellOrderDb.findByIds([sellOrder.id])
        return bo[0]
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    private formatOrder(tradeSession: TradeSession, apiOrder: any): SellOrder {
        const sellOrder = {
            gid: tradeSession.id,
            cid: apiOrder[2],
            type: apiOrder[8],
            price: apiOrder[16],
            tradeSystemGroup: 0, // means custom
            startAmount: apiOrder[7],
            exchangeId: apiOrder[0],
            amount: apiOrder[7],
            boughtAmount: 0,
            symbol: apiOrder[3],
            source: 'custom',
            status: 'new'
        }

        return sellOrder
    }
}
