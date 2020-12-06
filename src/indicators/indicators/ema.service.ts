import { Injectable } from '@nestjs/common';
import { throwIfEmpty } from 'rxjs/operators';
import { EMA } from 'trading-signals';

@Injectable()
export class EmaService {

    private ema: EMA;

    init(length: number): void{
        this.ema = new EMA(length);
    }

    update(price: number): void {
        this.ema.update(price)
    }

    getResult(): number {
        return Number(this.ema.getResult().toFixed(2))
    }
}
