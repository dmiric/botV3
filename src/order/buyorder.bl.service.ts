import { Injectable } from '@nestjs/common'
import { TradeSession } from '../tradesession/models/tradesession.entity'
import { UpdateResult } from 'typeorm'
import { BuyOrderService } from './buyorder.service'
import { BuyOrder } from './models/buyOrder.entity'
import { Candle } from '../interfaces/candle.model'
import { BuyOrderRev } from './models/buyOrder.rev.entity'
import { BuyOrderRevService } from './buyorder.rev.service'

@Injectable()
export class BuyOrderBLService {

    constructor(private buyOrderDb: BuyOrderService, private readonly revisionService: BuyOrderRevService) {}

    async createBuyOrder(tradeSession: TradeSession, type: string, tradeSystemGroup: number, candle?: Candle): Promise<BuyOrder> {
 
        const buyOrderData: BuyOrder = {
            gid: tradeSession.id,
            cid: Date.now(),
            tradeSystemGroup: tradeSystemGroup,
            type: type,
            startAmount: 0,
            amount: 0,
            boughtAmount: 0,
            symbol: tradeSession.symbol,
            source: 'bot',
            status: 'new',
        }

        if(candle) {
            buyOrderData.candleMts = candle.mts
            buyOrderData.candleOpen = candle.open
            buyOrderData.candleClose = candle.close
        }

        // we dont set the price so we can use order for market and limit order

        const buyOrder = await this.buyOrderDb.create(buyOrderData)
        const bo = await this.buyOrderDb.findByIds([buyOrder.id])
        const revision: BuyOrderRev = { ...buyOrder, updateTime: Date.now() }
        delete revision.id
        await this.revisionService.create(revision)
        return bo[0]
    }

    async getPrevBuyOrder(tradeSession: TradeSession, skip = 0): Promise<BuyOrder> {
        const buyOrders = await this.buyOrderDb.find({ where: { gid: tradeSession.id }, order: { id: 'DESC'}, skip: skip, take: 1 })
        return buyOrders[0]
    }
    async getBuyOrders(tradeSession: TradeSession): Promise<BuyOrder[]> {
        const buyOrders = await this.buyOrderDb.find({ where: { gid: tradeSession.id } })
        return buyOrders
    }

    async getBuyOrderByExchangeId(exchangeId: number): Promise<BuyOrder> {
        const buyOrders = await this.buyOrderDb.find({ where: { exchangeId: exchangeId } })
        return buyOrders[0]
    }

    async findBuyOrderByCid(tradeSession: TradeSession, cid: number): Promise<BuyOrder> {
        const buyOrders = await this.buyOrderDb.find({ where: { gid: tradeSession.id, cid: cid } })
        return buyOrders[0]
    }

    async updateBuyOrder(buyOrder: BuyOrder, revChanges = {}): Promise<UpdateResult> {
        const revision: BuyOrderRev = { ...buyOrder, updateTime: Date.now(), ...revChanges }
        delete revision.id
        await this.revisionService.create(revision)
        const res = await this.buyOrderDb.update({...buyOrder, ...revChanges})
        return res
    }


    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    async addCustomBuyOrder(tradeSession: TradeSession, order: any): Promise<BuyOrder> {
        const o = this.formatOrder(tradeSession, order)

        if (await this.findBuyOrderByCid(tradeSession, o.cid)) {
            return
        }

        const buyOrder = await this.buyOrderDb.create(o)
        const bo = await this.buyOrderDb.findByIds([buyOrder.id])
        return bo[0]
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    private formatOrder(tradeSession: TradeSession, apiOrder: any): BuyOrder {
        const buyOrder = {
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

        return buyOrder
    }

}
