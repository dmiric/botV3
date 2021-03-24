import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TradeSystemModule } from '../tradesystem/tradesystem.module';
import { BuyOrderService } from './buyorder.service';
import { BuyOrderBLService } from './buyorder.bl.service';
import { BuyOrder } from './models/buyOrder.entity';
import { SellOrderBLService } from './sellorder.bl.service';
import { SellOrderService } from './sellorder.service';
import { SellOrder } from './models/sellOrder.entity';

@Module({
    imports: [TypeOrmModule.forFeature([BuyOrder]), TypeOrmModule.forFeature([SellOrder]), TradeSystemModule],
    controllers: [],
    providers: [BuyOrderService, BuyOrderBLService, SellOrderBLService, SellOrderService],
    exports: [BuyOrderService, BuyOrderBLService, SellOrderBLService, SellOrderService]    
})
export class OrderModule { }
