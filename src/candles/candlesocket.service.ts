import { Injectable } from "@nestjs/common";
import { Subject, Observable, timer } from 'rxjs'
import { share, switchMap, retryWhen, delayWhen } from 'rxjs/operators'
import makeWebSocketObservable, {
    GetWebSocketResponses
} from 'rxjs-websockets';
import { TradeSession } from "src/tradesession/models/tradesession.entity";

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
        retryWhen(errors => errors.pipe( delayWhen(() => timer(10000)) )),
        )
    }  

    public setSubscription(tradeSession: TradeSession): void {
        let tradeSessionString = "trade:" + tradeSession.timeframe + ":" + tradeSession.symbol

        // use tBTCUSD stream on test server
        if(tradeSession.symbol == 'tTESTBTC:TESTUSD') {
            tradeSessionString = "trade:" + tradeSession.timeframe + ":tBTCUSD"
        } 

        const msg = this.getSubscribeMessage(tradeSessionString)
        this.input$.next(msg)
    }

    private getSubscribeMessage(tradeSessionString: string): string {
        return JSON.stringify({
            event: 'subscribe',
            channel: 'candles',
            key: tradeSessionString //'trade:TIMEFRAME:SYMBOL'
        })
    }

}

export type WebSocketPayload = string | ArrayBuffer | Blob