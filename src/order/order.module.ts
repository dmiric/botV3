import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TradeSystemModule } from '../tradesystem/tradesystem.module';
import { BuyOrderService } from './buyorder.service';
import { BuyOrderBLService } from './buyorder.bl.service';
import { BuyOrder } from './models/buyOrder.entity';
import { SellOrderBLService } from './sellorder.bl.service';
import { SellOrderService } from './sellorder.service';
import { SellOrder } from './models/sellOrder.entity';
import { BuyOrderRev } from './models/buyOrder.rev.entity';
import { SellOrderRev } from './models/sellOrder.rev.entity';
import { BuyOrderRevService } from './buyorder.rev.service';
import { SellOrderRevService } from './sellorder.rev.service';

@Module({
    imports: [TypeOrmModule.forFeature([BuyOrder, BuyOrderRev, SellOrder, SellOrderRev]), TradeSystemModule],
    controllers: [],
    providers: [BuyOrderService, BuyOrderBLService, SellOrderBLService, SellOrderService, BuyOrderRevService, SellOrderRevService],
    exports: [BuyOrderService, BuyOrderBLService, SellOrderBLService, SellOrderService]    
})
export class OrderModule { }
