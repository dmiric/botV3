import { BalanceService } from './balance.service';
import { Module } from '@nestjs/common';
import { WalletModule } from 'src/wallet/wallet.module';
import { OrderModule } from 'src/order/order.module';

@Module({
    imports: [OrderModule, WalletModule],
    controllers: [],
    providers: [BalanceService],
    exports: [BalanceService]
})
export class BalanceModule { }
