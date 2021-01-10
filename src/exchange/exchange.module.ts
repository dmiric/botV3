import { Module, forwardRef } from '@nestjs/common';
import { BehaviourModule } from '../behaviour/behaviour.module';
import { CandlesModule } from '../candles/candles.module';
import { InputModule } from '../input/input.module';
import { LogModule } from '../log/log.module';
import { OrdersModule } from '../orders/orders.module';
import { IndicatorsModule } from '../indicators/indicators.module';
import { TradeService } from './trade.service';

@Module({
    imports: [BehaviourModule, CandlesModule, forwardRef(() => OrdersModule), InputModule, LogModule, IndicatorsModule],
    controllers: [],
    providers: [TradeService],
    exports: [TradeService]

})
export class ExchangeModule {}
