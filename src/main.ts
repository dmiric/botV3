Object.assign(global, { WebSocket: require('ws') });

import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { CandlesModule } from './candles/candles.module'
import { Key } from './interfaces/key.model'
import { OrdersModule } from './orders/orders.module';
import { OrdersService } from './orders/orders.service';
import { KeyService } from './candles/key.service';
import { HistCandlesService } from './candles/hist/histcandles.service'
import { BacktestModule } from './backtest/backtest.module'
import { TesterService } from './backtest/tester.service';
import { InputModule } from './input/input.module';
import { ReadxlsService } from './input/readxls.service';
import { ArgvService } from './input/argv.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  await app.init();

  const ordersService = app.select(OrdersModule).get(OrdersService, { strict: true })
  const keyService = app.select(CandlesModule).get(KeyService, { strict: true })
  const testerService = app.select(BacktestModule).get(TesterService, { strict: true })
  const readXlsService = app.select(InputModule).get(ReadxlsService, { strict: true })
  const argvService = app.select(InputModule).get(ArgvService, { strict: true })
  const histCandlesService = app.select(CandlesModule).get(HistCandlesService, { strict: true });

  const firstOrder = ordersService.getOrder(101);
  const dates = readXlsService.getDates() 
  await histCandlesService.prepareHistData(ordersService.getOrders());

  // these keys should be returned by the key service
  const key: Key = {
    trade: "trade",
    timeframe: firstOrder.meta.timeframe, // should be first order timeframe
    symbol: firstOrder.symbol,
    indicatorOffset: argvService.getIndicatorOffset()
  }
  
  const testingKey = keyService.getTestingKey(key, dates[0], dates[1])
  
  testerService.testingCycle(testingKey)
  //logService.showLog()

  
  // candleSocketService.initStream(key)
  // const msg = candleSocketService.getSubscribeMessage()

  // let candleSubscription: Subscription = candleSocketService.messages$.subscribe(
  //   (message: string) => {
  //     const trimmed = message.substring(0, 30)
  //     console.log('received message:', trimmed)
  //     respond to server
  //     const data = JSON.parse(message)

  //     if (data.event === "info") {
  //       if we just connected to the stream we find the last order we want to start from
  //       and we send a message to start the stream  
  //       candleSocketService.input$.next(msg)
  //     } else {
  //       if (data.event) {
  //         return;
  //       }
  //       check if (typeof data[0][0] === 'number') { in isCandle if this doesnt work
  //       also const singleCandleRaw = <Array<any>>data[0];
  //       maybe wrap this in additional array to solve this
  //       candleSet = parseCandlesService.handleCandleStream(data, key, candleSet)
  //       if (candleSet && candleSet.length > 1) {
  //         console.log(candleSet)
  //         const order = indicatorService.getNextOrderThatMatchesTheConditions(candleSet)

  //         if (order) {
  //           const testXaXa = 1;
  //           post order on BFX
  //           update orders
  //         }

  //       }

  //     }
  //   },
  //   (error: Error) => {
  //     const { message } = error
  //     if (message === normalClosureMessage) {
  //       console.log('server closed the websocket connection normally')
  //     } else {
  //       console.log('socket was disconnected due to error:', message)
  //     }
  //   },
  //   () => {
  //     The clean termination only happens in response to the last
  //     subscription to the observable being unsubscribed, any
  //     other closure is considered an error.
  //     console.log('the connection was closed in response to the user')
  //   },
  // )

}
bootstrap();
