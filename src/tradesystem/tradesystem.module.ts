import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TradeSystemRules } from './models/tradesystem.rules.entity';
import { TradeSystemRulesService } from './tradesystem.rules.service';

@Module({
    imports: [TypeOrmModule.forFeature([TradeSystemRules])],
    controllers: [],
    providers: [TradeSystemRulesService],
    exports: [TradeSystemRulesService]
})

export class TradeSystemModule {}
