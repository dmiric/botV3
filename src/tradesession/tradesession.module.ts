import { Module } from '@nestjs/common';
import { TradeSessionService } from './tradesession.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TradeSession } from './models/tradesession.entity';

@Module({
    imports: [TypeOrmModule.forFeature([TradeSession])],
    controllers: [],
    providers: [TradeSessionService],
    exports: [TradeSessionService]    
})
export class TradeSessionModule { }
