Object.assign(global, { WebSocket: require('ws') });

import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { CandlesModule } from './candles/candles.module'
import { Key } from './interfaces/key.model'
import { OrdersModule } from './orders/orders.module'
import { OrdersService } from './orders/orders.service'
import { HistCandlesService } from './candles/hist/histcandles.service'
import { BacktestModule } from './backtest/backtest.module'
import { TesterService } from './backtest/tester.service'
import { InputModule } from './input/input.module'
import { ReadxlsService } from './input/readxls.service'
import { ArgvService } from './input/argv.service'
import { ExchangeModule } from './exchange/exchange.module';
import { TradeService } from './exchange/trade.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  await app.init();

  const ordersService = app.select(OrdersModule).get(OrdersService, { strict: true })
  const testerService = app.select(BacktestModule).get(TesterService, { strict: true })
  const readXlsService = app.select(InputModule).get(ReadxlsService, { strict: true })
  const argvService = app.select(InputModule).get(ArgvService, { strict: true })
  const histCandlesService = app.select(CandlesModule).get(HistCandlesService, { strict: true });
  const tradeService = app.select(ExchangeModule).get(TradeService, { strict: true });

  const firstOrder = ordersService.getOrder(101);
  const dates = readXlsService.getDates()


  // these keys should be returned by the key service
  const key: Key = {
    trade: "trade",
    timeframe: firstOrder.meta.timeframe, // should be first order timeframe
    symbol: firstOrder.symbol,
    indicatorOffset: argvService.getIndicatorOffset(),
    start: dates[0],
    end: dates[1]
  }

  if (argvService.isLive()) {
    tradeService.trade(key)
  } else {
    await histCandlesService.prepareHistData(ordersService.getOrders());
    testerService.testingCycle(key)
  }

  
}
bootstrap();
