import { Module, Logger } from '@nestjs/common';
import { InputModule } from '../input/input.module';
import { OrderService } from './order.service';
import { OrderCycleService } from './ordercycle.service';
import { OrderCyclesService } from './ordercycles.service';
import { OrdersService } from './orders.service'
import { OrderSocketService } from './ordersocket.service';


@Module({
    imports: [InputModule],
    controllers: [],
    providers: [OrdersService, OrderService, OrderCycleService, OrderCyclesService, OrderSocketService, Logger],
    exports: [OrdersService, OrderService, OrderCycleService, OrderCyclesService, OrderSocketService],
})
export class OrdersModule { }
