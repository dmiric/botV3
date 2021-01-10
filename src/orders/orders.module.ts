import { Module, forwardRef } from '@nestjs/common';
import { LogModule } from '../log/log.module';
import { InputModule } from '../input/input.module';
import { OrderService } from './order.service';
import { OrderCycleService } from './ordercycle.service';
import { OrderCyclesService } from './ordercycles.service';
import { OrdersService } from './orders.service'
import { OrderSocketService } from './ordersocket.service';


@Module({
    imports: [InputModule, LogModule],
    controllers: [],
    providers: [OrdersService, OrderService, OrderCycleService, OrderCyclesService, OrderSocketService],
    exports: [OrdersService, OrderService, OrderCycleService, OrderCyclesService, OrderSocketService],
})
export class OrdersModule { }
