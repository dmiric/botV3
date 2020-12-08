import { Injectable } from "@nestjs/common";
import { Key } from '../interfaces/key.model';
// import * as WebSocket from "ws";
import { Subject, Observable } from 'rxjs'
import { share, switchMap, retryWhen } from 'rxjs/operators'
import makeWebSocketObservable, {
    GetWebSocketResponses
} from 'rxjs-websockets';

@Injectable()
export class CandleSocketService {

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

    public setSubscription(key: Key): void {
        const keyString = "trade:" + key.timeframe + ":" + key.symbol
        const msg = this.getSubscribeMessage(keyString)
        this.input$.next(msg)
    }

    private getSubscribeMessage(keyString: string): string {
        return JSON.stringify({
            event: 'subscribe',
            channel: 'candles',
            key: keyString //'trade:TIMEFRAME:SYMBOL'
        })
    }

}

export type WebSocketPayload = string | ArrayBuffer | Blob