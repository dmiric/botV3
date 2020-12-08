import { Module, forwardRef } from '@nestjs/common';
import { BehaviourModule } from '../behaviour/behaviour.module';
import { CandlesModule } from 'src/candles/candles.module';
import { InputModule } from 'src/input/input.module';
import { LogModule } from 'src/log/log.module';
import { OrdersModule } from 'src/orders/orders.module';
import { IndicatorsModule } from 'src/indicators/indicators.module';
import { TradeService } from './trade.service';

@Module({
    imports: [BehaviourModule, CandlesModule, forwardRef(() => OrdersModule), InputModule, LogModule, IndicatorsModule],
    controllers: [],
    providers: [TradeService],
    exports: [TradeService]

})
export class ExchangeModule {}
