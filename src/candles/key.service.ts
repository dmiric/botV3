import { Injectable } from '@nestjs/common';
import { Key, TestingKey } from '../interfaces/key.model'

@Injectable()
export class KeyService {
    private timeframe: string
    private key: string

    public init(keyValues: Key): void {
        this.setKey(keyValues)
        this.setTimeFrame(keyValues)
    }

    public getTestingKey(key: Key, start: number, end: number): TestingKey {
        return {
            ...key,
            start: start,
            end: end
        }
    }

    private setKey(keyValues: Key) {
        this.key = keyValues.trade + ":" + keyValues.timeframe + ":" + keyValues.symbol;
    }

    private setTimeFrame(keyValues: Key) {
        this.timeframe = keyValues.timeframe;
    }

    public getTimeFrame(): string {
        return this.timeframe;
    }

    public getSubscribeMessage(): string {
        return JSON.stringify({
            event: 'subscribe',
            channel: 'candles',
            key: this.key //'trade:TIMEFRAME:SYMBOL'
        })
    }
}