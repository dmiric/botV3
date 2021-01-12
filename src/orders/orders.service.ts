import { Injectable } from '@nestjs/common';
import { Order } from '../interfaces/order.model';
import { Key } from '../interfaces/key.model';


@Injectable()
// refactor this Service to BuyOrderService
export class OrdersService {

    private availableForPosition = [];
    private orders: Order[];

    constructor() {
        this.availableForPosition[101] = 1.000000;
        this.availableForPosition[102] = 1.147962;
        this.availableForPosition[103] = 1.317818;
        this.availableForPosition[104] = 1.512805;
        this.availableForPosition[105] = 1.736644;
        this.availableForPosition[106] = 1.993602;
        this.availableForPosition[107] = 2.288580;
        this.availableForPosition[108] = 2.627205;
        this.availableForPosition[109] = 3.015932;
        this.availableForPosition[110] = 3.462177;
        this.availableForPosition[111] = 3.974449;
        this.availableForPosition[112] = 4.562519;
        this.availableForPosition[113] = 5.237601;
        this.availableForPosition[114] = 6.012569;
        this.availableForPosition[115] = 6.902204;
        this.availableForPosition[116] = 7.923471;
        this.availableForPosition[117] = 9.095847;
        this.availableForPosition[118] = 10.441692;
        this.availableForPosition[119] = 11.986670;
        this.availableForPosition[119] = 13.760253;
    }

    getOrders(): Order[] {
        return this.orders;
    }

    getOrder(key: Key, id: number, price: number): Order {
        return this.createOrder(key, id, price)

    }

    createOrder(key: Key, id: number, price: number): Order {
        return {
            cid: Date.now(),
            type: "LIMIT",
            symbol: key.symbol,
            amount: this.calculateOrderAmount(key.startBalance, id, price),
            meta: {
                aff_code: "uxiQm6DLx",
                timeframe: key.timeframe,
                id: id,
                safeDistance: key.safeDistance,
                tradeExecuted: false
                //target: key.target // this needs to be replaced
            }
        }
    }

    calculateOrderAmount(startBalance: number, id: number, price: number): number {
        return (startBalance * this.availableForPosition[id] / 100) / price
    }

}
