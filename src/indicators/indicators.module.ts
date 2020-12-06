import { Module } from '@nestjs/common';
import { EmaService } from './indicators/ema.service';

@Module({
    imports: [],
    controllers: [],
    providers: [EmaService],
    exports: [EmaService],
})
export class IndicatorsModule { }
