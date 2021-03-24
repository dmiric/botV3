import { Module, Logger } from '@nestjs/common';
import { TradeSystemModule } from '../tradesystem/tradesystem.module';
import { BehaviourTwoService } from './behaviour.two.service';
import { BencBehaviourService } from './bencbehaviour.service';

@Module({
    imports: [TradeSystemModule],
    controllers: [],
    providers: [BencBehaviourService, Logger, BehaviourTwoService],
    exports: [BencBehaviourService, BehaviourTwoService],
})
export class BehaviourModule {}
