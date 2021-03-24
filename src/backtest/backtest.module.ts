import { Module } from '@nestjs/common';
import { BehaviourModule } from '../behaviour/behaviour.module';
import { CandlesModule } from '../candles/candles.module';
import { InputModule } from '../input/input.module';
import { BackTestDataSource } from './btest.datasource.service';
import { TestDataService } from './testdata.service';
import { BullModule } from '@nestjs/bull';
@Module({
    imports: [BehaviourModule, CandlesModule, InputModule, 
        BullModule.registerQueueAsync({
        name: 'bot'
    })],
    controllers: [],
    providers: [TestDataService, BackTestDataSource],
    exports: [TestDataService, BackTestDataSource],

})
export class BacktestModule {}