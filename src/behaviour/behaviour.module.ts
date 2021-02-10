import { Module, Logger } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { BencBehaviourService } from './bencbehaviour.service';

@Module({
    imports: [OrdersModule],
    controllers: [],
    providers: [BencBehaviourService, Logger],
    exports: [BencBehaviourService],
})
export class BehaviourModule {}
