import { Module, Logger, forwardRef } from '@nestjs/common'
import { BehaviourModule } from '../behaviour/behaviour.module'
import { InputModule } from '../input/input.module'
import { TradeService } from './trade.service'
import { RestService } from './rest.service'
import { ReconnectService } from './reconnect.service'
import { TradeSessionModule } from '../tradesession/tradesession.module'
import { OrderModule } from '../order/order.module'
import { CandlesModule } from '../candles/candles.module'
import { BFXReqService } from './bfxreq.service'
import { BullModule } from '@nestjs/bull';
import { TradeProcessor } from './trade.processor'
import { CandleProcessor } from './candle.processor'
import { SocketFactory } from './socket.factory'
import { StrategyFactory } from './strategy.factory'
import { StrategyTwoReportService } from './reports/strategy.two.report.service'
import { ConfigModule } from 'src/config/config.module'

@Module({
    imports: [BehaviourModule, ConfigModule, CandlesModule, forwardRef(() => InputModule), TradeSessionModule, OrderModule,
        BullModule.registerQueueAsync({
            name: 'bot'
        })
    ],
    controllers: [],
    providers: [TradeService, Logger, RestService, ReconnectService,
        BFXReqService, TradeProcessor, CandleProcessor, SocketFactory, StrategyFactory, StrategyTwoReportService],
    exports: [TradeService, ReconnectService, RestService,
        BFXReqService, TradeProcessor, CandleProcessor, StrategyTwoReportService]
})

export class ExchangeModule { }