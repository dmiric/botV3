import { Controller, Get } from '@nestjs/common';
import { TradeService } from '../exchange/trade.service';

@Controller('stop-x345')
export class StopController {

    constructor(private tradeService: TradeService) { }

    @Get()
    stop() {
        const statusInfo = this.tradeService.stopTrade()
        return statusInfo;
    }

}
