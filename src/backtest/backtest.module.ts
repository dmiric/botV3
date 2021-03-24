import { Module } from '@nestjs/common';
import { BehaviourModule } from '../behaviour/behaviour.module';
import { CandlesModule } from '../candles/candles.module';
import { InputModule } from '../input/input.module';
import { BackTestDataSource } from './btest.datasource.service';
import { BullModule } from '@nestjs/bull';
@Module({
    imports: [BehaviourModule, CandlesModule, InputModule, 
        BullModule.registerQueueAsync({
        name: 'bot'
    })],
    controllers: [],
    providers: [BackTestDataSource],
    exports: [BackTestDataSource],

})
export class BacktestModule {}