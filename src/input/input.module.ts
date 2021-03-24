import { Module, forwardRef } from '@nestjs/common';
import { TradeSessionModule } from 'src/tradesession/tradesession.module';
import { TradeSystemModule } from 'src/tradesystem/tradesystem.module';
import { ExchangeModule } from '../exchange/exchange.module';
import { ApiKeyService } from './apikey.service';
import { ArgvService } from './argv.service';
import { HookController } from './hook.controller';
import { HookService } from './hook.service';
import { StopController } from './stop.controller';
import { ReportController } from './report.controller'

@Module({
    imports: [forwardRef(() => ExchangeModule), TradeSessionModule, TradeSystemModule],
    controllers: [HookController, StopController, ReportController],
    providers: [ApiKeyService, ArgvService, HookService],
    exports: [ApiKeyService, ArgvService],
})
export class InputModule {}
