import { WalletService } from './wallet.service';
import { Module } from '@nestjs/common';

@Module({
    imports: [],
    controllers: [],
    providers: [
        WalletService,],
    exports: [
        WalletService,],
})
export class WalletModule { }
