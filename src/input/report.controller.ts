import { Controller, Get, Render, Param } from '@nestjs/common';
import { StrategyTwoReportService } from '../exchange/reports/strategy.two.report.service'
@Controller('report')
export class ReportController {

    constructor(private readonly reportService: StrategyTwoReportService) { }

    @Get('/:tradeSessionId/:unit?')
    @Render('report')
    async report(@Param('tradeSessionId') tradeSessionId: number, @Param('unit') unit = 'week'): Promise<any> {
        const message = await this.reportService.report(tradeSessionId, unit)
        return { message: JSON.stringify(message) };
    }

}
