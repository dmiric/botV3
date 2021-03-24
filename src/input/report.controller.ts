import { Controller, Get, Render, Param } from '@nestjs/common';
import { StrategyTwoReportService } from 'src/exchange/reports/strategy.two.report.service'
import { ReportReqDto } from './dto/ReportReqDto';

@Controller('report')
export class ReportController {

    constructor(private readonly reportService: StrategyTwoReportService) { }

    @Get(':tradeSessionId')
    @Render('report')
    async root(@Param() params: ReportReqDto): Promise<any> {
        const message = await this.reportService.report(params.tradeSessionId)
        return { message: JSON.stringify(message) };
    }

}
