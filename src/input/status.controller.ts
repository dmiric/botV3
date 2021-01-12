import { Controller, Get } from '@nestjs/common';
import { TradeService } from '../exchange/trade.service';

@Controller('status')
export class StatusController {

    constructor(private tradeService: TradeService) { }

    @Get()
    status() {
        const statusInfo = this.tradeService.getStatusInfo()
        return statusInfo;
    }

}
