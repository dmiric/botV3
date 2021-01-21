import { Injectable } from "@nestjs/common";
import { Key } from '../interfaces/key.model';
import { Subject, Observable, timer } from 'rxjs'
import { share, switchMap, retryWhen, delayWhen } from 'rxjs/operators'
import makeWebSocketObservable, {
    GetWebSocketResponses
} from 'rxjs-websockets';

@Injectable()
export class CandleSocketService {

    public input$ = new Subject<string>()
    private socket$: Observable<GetWebSocketResponses<WebSocketPayload>>
    public messages$: Observable<WebSocketPayload>

    public createSocket(): void {
        this.socket$ = makeWebSocketObservable('wss://api-pub.bitfinex.com/ws/2')
        this.messages$ = this.socket$.pipe(
             // the observable produces a value once the websocket has been opened
        switchMap((getResponses: GetWebSocketResponses) => {
            console.log('candle socket opened')
            return getResponses(this.input$)
        }),
        share(),
        retryWhen(errors => errors.pipe( delayWhen(() => timer(1000)) )),
        )
    }  

    public setSubscription(key: Key): void {
        let keyString = "trade:" + key.timeframe + ":" + key.symbol

        // use tBTCUSD stream on test server
        if(key.symbol == 'tTESTBTC:TESTUSD') {
            keyString = "trade:" + key.timeframe + ":tBTCUSD"
        } 

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