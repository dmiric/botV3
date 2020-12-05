import { Injectable } from '@nestjs/common';
import { ReadxlsService } from '../input/readxls.service';
import { Order, ApiOrder } from '../interfaces/order.model'


@Injectable()
export class OrdersService {

    private orders: Order[];

    constructor(private readXls: ReadxlsService) {
        if (!this.orders) {
            this.orders = this.readXls.readFile()
        }
    }

    getOrders(): Order[] {
        return this.orders;
    }

    getOrder(id: number): Order {
        return this.orders[id];
    }

}
