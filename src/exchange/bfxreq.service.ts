import { Injectable } from "@nestjs/common"
import { ApiOrder } from '../interfaces/order.model'
import { BuyOrder } from "../order/models/buyOrder.entity"
import { SellOrder } from '../order/models/sellOrder.entity'

@Injectable()
export class BFXReqService {

    private lastOrderCid = 0

    public makeBuyOrder(order: BuyOrder): any {
        // make sure we prevent any order duplication
        if (this.lastOrderCid == order.cid) {
            return
        }
        this.lastOrderCid = order.cid

        // make order
        const apiOrder = this.prepareApiOrder(order)
        return [0, 'on', null, apiOrder]
    }

    public makeSellOrder(order: SellOrder): any {
        // make sure we prevent any order duplication
        if (this.lastOrderCid == order.cid) {
            return
        }
        this.lastOrderCid = order.cid

        // make order
        const apiOrder = this.prepareApiOrder(order)
        if (order.priceTrailing != null) {
            apiOrder['price_trailing'] = order.priceTrailing.toFixed(2)
        }
        return [0, 'on', null, apiOrder]
    }

    /*
    public updateOrder(order: Order): any {
        // make order
        const apiOrder = {
            cid: order.cid,
            meta: { ...order.meta }
        }
        return [0, 'uo', null, apiOrder]
    }
    */

    public requestReqcalc(): any {
        return [0, 'calc', null, [["balance"]]]
    }

    public cancelOrder(id: number): any {
        return [0, 'oc', null, { id: id }]
    }

    private prepareApiOrder(order: BuyOrder | SellOrder): ApiOrder {
        const apiOrder = {
            gid: order.gid,
            cid: order.cid,
            type: order.type,
            symbol: order.symbol,
            amount: order.amount.toFixed(4),
            meta: {
                aff_code: "uxiQm6DLx", tradeSessionId: order.gid, startPrice: order.candleClose // giodjgfoijfod // ovo vj. nije ispravno
            }
        }

        // orders that don't have price are switched to MARKET order
        if (order.price != null) {
            apiOrder['price'] = order.price.toFixed(2)
        }

        return apiOrder;
    }

}