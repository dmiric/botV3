import { Controller, Get } from '@nestjs/common';
import { TradeService } from '../exchange/trade.service';

@Controller('closed-trades')
export class ClosedTradesController {

    constructor(private tradeService: TradeService) { }

    @Get()
    status(): any {
        //return this.tradeService.getClosedTrades()
    }

}
