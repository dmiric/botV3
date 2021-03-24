import { Process, Processor, OnQueueError, OnQueueFailed, OnQueueStalled, OnQueueWaiting } from '@nestjs/bull';
import { Job } from 'bull';
import { TradeService } from './trade.service';

@Processor('bot')
export class CandleProcessor {

    constructor(
        private readonly tradeService: TradeService
    ) { }

    @Process('candles')
    async handle(job: Job): Promise<void> {
        await this.tradeService.candleStream(job.data.message)
    }

    @OnQueueError()
    @OnQueueFailed()
    @OnQueueStalled()
    @OnQueueWaiting()
    async onE(job: Job): Promise<void> {
        console.log(`Processing job ${job.id} of type ${job.name} with data ${job.data}...`,);
        console.log(job)
    }
}