import { Module, forwardRef } from '@nestjs/common';
import { TradeSessionModule } from '../tradesession/tradesession.module';
import { TradeSystemModule } from '../tradesystem/tradesystem.module';
import { ExchangeModule } from '../exchange/exchange.module';
import { ApiKeyService } from './apikey.service';
import { HookController } from './hook.controller';
import { HookService } from './hook.service';
import { StopController } from './stop.controller';
import { ReportController } from './report.controller'
import { ReportLastController } from './report.last.controller'
import { ConfigModule } from '../config/config.module';

@Module({
    imports: [forwardRef(() => ExchangeModule), TradeSessionModule, TradeSystemModule, ConfigModule],
    controllers: [HookController, StopController, ReportController, ReportLastController],
    providers: [ApiKeyService, HookService],
    exports: [ApiKeyService],
})
export class InputModule {}
