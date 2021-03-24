import { Module } from '@nestjs/common';
import { ParseCandlesService } from './parsecandles.service';
import { HistCandlesService } from './hist/histcandles.service';
import { CandleUtilService } from './candleutil.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Candle } from './models/candle.entity';
import { CandleDbService } from './candle.db.service';

@Module({
    imports: [TypeOrmModule.forFeature([Candle])],
    controllers: [],
    providers: [ParseCandlesService, HistCandlesService, CandleUtilService, CandleDbService],
    exports: [ParseCandlesService, HistCandlesService, CandleUtilService, CandleDbService]
})
export class CandlesModule { }
