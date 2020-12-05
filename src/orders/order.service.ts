import { Injectable } from '@nestjs/common';
import { Order, ApiOrder } from '../interfaces/order.model'

@Injectable()
export class OrderService {

    /**
     * We do this convert amount and price to strings for the bfx API
     * 
     * @param order 
     */
    prepareApiOrder(order: Order): ApiOrder {
        return {
            cid: order.cid,
            type: order.type,
            amount: "" + order.amount, // should be string when sending to bfx
            symbol: order.symbol,
            price: "" + order.price, // should be string when sending to bfx
            meta: order.meta
        }
    }


}
