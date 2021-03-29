import { BacktestModule } from './backtest/backtest.module';
import { TradeSystemModule } from './tradesystem/tradesystem.module';
import { TradeSessionModule } from './tradesession/tradesession.module';
import { ReconnectService } from './exchange/reconnect.service';
import { StatusController } from './input/status.controller';
import { ExchangeModule } from './exchange/exchange.module';
import { BehaviourModule } from './behaviour/behaviour.module';
import { InputModule } from './input/input.module';
import { CandlesModule } from './candles/candles.module';
import { Module, Logger } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClosedTradesController } from './input/closedtrades.controller';
import { OrderModule } from './order/order.module';
import { BullModule } from '@nestjs/bull';
import { ConfigService } from './config/config.service';
import { ConfigModule } from './config/config.module'

import { SqliteConnectionOptions } from 'typeorm/driver/sqlite/SqliteConnectionOptions';


@Module({
  imports: [
    BacktestModule,
    ConfigModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        type: 'sqlite',
        database: configService.getConfigDir() + '/botV3.db',
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.isProduction() ? false : true,
      } as SqliteConnectionOptions),
      inject: [ConfigService],
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: 'localhost',
          port: 6379,
        },
        prefix: configService.getName(),
        settings: {
          maxStalledCount: 0
        }
      }),
      inject: [ConfigService],
    }),
    TradeSystemModule,
    TradeSessionModule,
    OrderModule,
    ExchangeModule,
    BehaviourModule,
    InputModule,
    CandlesModule
  ],
  controllers: [StatusController, AppController, ClosedTradesController],
  providers: [
    Logger,
    AppService
  ],
})
export class AppModule {

  constructor(private reConnectService: ReconnectService) {
    this.reConnectService.reConnect()
  }

}
