import { Injectable } from '@nestjs/common';
import { OrderCycle } from '../interfaces/ordercycle.model';
import { OrderCycleService } from './ordercycle.service';

@Injectable()
export class OrderCyclesService {

private orderCycles: OrderCycle[] = []

private totalEarnings = 0;

addOrderCycle(orderCycle: OrderCycle): void {
    this.orderCycles.push(orderCycle)
    //this.showStats()
}

showStats(): void {
    const output = this.orderCycles
    const o2 = []
    for( const o of output) {
        delete o.buyOrders
        o2.push(o)
    }
    console.table(o2);
}

}
