import { Module } from '@nestjs/common';
import { OrdersModule } from 'src/orders/orders.module';
import { BencBehaviourService } from './bencbehaviour.service';

@Module({
    imports: [OrdersModule],
    controllers: [],
    providers: [BencBehaviourService],
    exports: [BencBehaviourService],
})
export class BehaviourModule {}
