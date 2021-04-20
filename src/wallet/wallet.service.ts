import { Injectable } from '@nestjs/common';

@Injectable()
export class WalletService {
    private wallet = { 
        USD: 0 
    }

    get(currency: string): number {
        return this.wallet[currency]
    }

    update(currency: string, amount: number): void {
        this.wallet[currency] = amount
    }
}
