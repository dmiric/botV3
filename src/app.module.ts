import { StatusController } from './input/status.controller';
import { HookService } from './input/hook.service';
import { HookController } from './input/hook.controller';
import { TradeService } from './exchange/trade.service';
import { ExchangeModule } from './exchange/exchange.module';
import { LogModule } from './log/log.module';
import { BencBehaviourService } from './behaviour/bencbehaviour.service';
import { BehaviourModule } from './behaviour/behaviour.module';
import { ArgvService } from './input/argv.service';
import { LogService } from './log/log.service';
import { CandleUtilService } from './candles/candleutil.service';
import { OrderCyclesService } from './orders/ordercycles.service';
import { OrderCycleService } from './orders/ordercycle.service';
import { KeyService } from './candles/key.service';
import { OrdersModule } from './orders/orders.module';
import { InputModule } from './input/input.module';
import { OrderService } from './orders/order.service';
import { OrdersService } from './orders/orders.service';
import { CandlesModule } from './candles/candles.module';
import { Module, Logger } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';


@Module({
  imports: [
    ExchangeModule,
    LogModule,
    BehaviourModule,
    OrdersModule,
    InputModule,
    CandlesModule
  ],
  controllers: [
    StatusController,
    HookController, AppController],
  providers: [
    Logger,
    HookService,
    TradeService,
    BencBehaviourService,
    ArgvService,
    LogService,
    CandleUtilService,
    OrderCyclesService,
    OrderCycleService,
    KeyService,
    BencBehaviourService,
    OrderService,
    OrdersService,
    AppService],
})
export class AppModule {


}
