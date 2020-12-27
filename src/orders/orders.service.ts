import { Injectable } from '@nestjs/common';
import { ArgvService } from 'src/input/argv.service';
import { ReadxlsService } from '../input/readxls.service';
import { Order, ApiOrder } from '../interfaces/order.model'


@Injectable()
export class OrdersService {

    private orders: Order[];

    constructor(private readXls: ReadxlsService, private argvService: ArgvService) {
        if (!this.orders) {
            this.orders = this.readXls.readOrders()
        }
    }

    getOrders(): Order[] {
        return this.orders;
    }

    getOrder(id: number): Order {
        return this.orders[id];
    }

}
