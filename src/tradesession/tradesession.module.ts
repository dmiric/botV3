import { Module } from '@nestjs/common';
import { TradeSessionService } from './tradesession.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TradeSession } from './models/tradesession.entity';
import { TradeSessionBLService } from './tradesession.bl.service';

@Module({
    imports: [TypeOrmModule.forFeature([TradeSession])],
    controllers: [],
    providers: [TradeSessionService, TradeSessionBLService],
    exports: [TradeSessionService, TradeSessionBLService] 
})
export class TradeSessionModule { }
