import { Injectable } from "@nestjs/common";
// import * as WebSocket from "ws";

import { Key } from '../interfaces/key.model'

import { Subject, Observable, Subscription } from 'rxjs'
import { share, switchMap, retryWhen } from 'rxjs/operators'
import makeWebSocketObservable, {
    GetWebSocketResponses
} from 'rxjs-websockets';

@Injectable()
export class CandleSocketService {

    private timeframe: string
    private key: string

    public input$ = new Subject<string>()
    private socket$ = makeWebSocketObservable('wss://api-pub.bitfinex.com/ws/2')

    public messages$: Observable<WebSocketPayload> = this.socket$.pipe(
        // the observable produces a value once the websocket has been opened
        switchMap((getResponses: GetWebSocketResponses) => {
            console.log('websocket opened')
            return getResponses(this.input$)
        }),
        share(),
    )

    public initStream(keyValues: Key): void{
        this.setKey(keyValues)
        this.setTimeFrame(keyValues)
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

export type WebSocketPayload = string | ArrayBuffer | Blob