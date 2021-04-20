import { Controller, Get, Render, Param } from '@nestjs/common';
import { StrategyTwoReportService } from '../exchange/reports/strategy.two.report.service'
@Controller('report-last')
export class ReportLastController {

    constructor(private readonly reportService: StrategyTwoReportService) { }

    @Get(':unit?')
    @Render('report')
    async report2(@Param('unit') unit = 'week'): Promise<any> {
        const message = await this.reportService.report(null, unit)
        return { message: JSON.stringify(message) };
    }

}