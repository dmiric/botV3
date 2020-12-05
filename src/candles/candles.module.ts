import { Module } from '@nestjs/common';
import { ParseCandlesService } from './parsecandles.service';
import { CandleSocketService } from './candlesocket.service';
import { HistCandlesService } from './hist/histcandles.service';
import { KeyService } from './key.service';
import { CandleUtilService } from './candleutil.service';

@Module({
    imports: [],
    controllers: [],
    providers: [ParseCandlesService, CandleSocketService, HistCandlesService, KeyService, CandleUtilService],
    exports: [ParseCandlesService, CandleSocketService, HistCandlesService, KeyService, CandleUtilService]
})
export class CandlesModule { }
