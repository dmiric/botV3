import { Module, forwardRef, Logger } from '@nestjs/common'
import { BehaviourModule } from '../behaviour/behaviour.module'
import { CandlesModule } from '../candles/candles.module'
import { InputModule } from '../input/input.module'
import { OrdersModule } from '../orders/orders.module'
import { TradeService } from './trade.service'
import { RestService } from './rest.service'
import { ReconnectService } from './reconnect.service'

@Module({
    imports: [BehaviourModule, CandlesModule, forwardRef(() => OrdersModule), InputModule],
    controllers: [],
    providers: [TradeService, Logger, RestService, ReconnectService],
    exports: [TradeService, ReconnectService, RestService]
})

export class ExchangeModule {}
