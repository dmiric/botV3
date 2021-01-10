import { Module, forwardRef } from '@nestjs/common';
import { BehaviourModule } from '../behaviour/behaviour.module';
import { CandlesModule } from '../candles/candles.module';
import { InputModule } from '../input/input.module';
import { LogModule } from '../log/log.module';
import { OrdersModule } from '../orders/orders.module';
import { TestDataService } from './testdata.service';
import { TesterService } from './tester.service';
import { IndicatorsModule } from '../indicators/indicators.module';

@Module({
    imports: [BehaviourModule, CandlesModule, forwardRef(() => OrdersModule), InputModule, LogModule, IndicatorsModule],
    controllers: [],
    providers: [TesterService, TestDataService],
    exports: [TesterService, TestDataService],

})
export class BacktestModule {}
