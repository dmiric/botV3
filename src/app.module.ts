import { HookService } from './input/hook.service';
import { HookController } from './input/hook.controller';
import { TradeService } from './exchange/trade.service';
import { ExchangeModule } from './exchange/exchange.module';
import { EmaService } from './indicators/indicators/ema.service';
import { LogModule } from './log/log.module';
import { BencBehaviourService } from './behaviour/bencbehaviour.service';
import { BehaviourModule } from './behaviour/behaviour.module';
import { ArgvService } from './input/argv.service';
import { LogService } from './log/log.service';
import { TesterService } from './backtest/tester.service';
import { BacktestModule } from './backtest/backtest.module';
import { CandleUtilService } from './candles/candleutil.service';
import { OrderCyclesService } from './orders/ordercycles.service';
import { OrderCycleService } from './orders/ordercycle.service';
import { TestDataService } from './backtest/testdata.service';
import { KeyService } from './candles/key.service';
import { HistCandlesService } from './candles/hist/histcandles.service';
import { OrdersModule } from './orders/orders.module';
import { IndicatorsModule } from './indicators/indicators.module';
import { InputModule } from './input/input.module';
import { OrderService } from './orders/order.service';
import { OrdersService } from './orders/orders.service';
import { CandlesModule } from './candles/candles.module';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ExchangeModule,
    LogModule,
    BehaviourModule,
    BacktestModule,
    OrdersModule,
    IndicatorsModule,
    InputModule,
    CandlesModule,],
  controllers: [
    HookController, AppController],
  providers: [
    HookService,
    TradeService,
    EmaService,
    BencBehaviourService,
    ArgvService,
    LogService,
    TesterService,
    CandleUtilService,
    OrderCyclesService,
    OrderCycleService,
    TestDataService,
    KeyService,
    HistCandlesService,
    BencBehaviourService,
    OrderService,
    OrdersService,
    AppService],
})
export class AppModule {


}
