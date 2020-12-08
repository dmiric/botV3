import { Injectable } from "@nestjs/common";
// import * as WebSocket from "ws";

import { Key } from '../interfaces/key.model'

import { Subject, Observable, Subscription } from 'rxjs'
import { share, switchMap, retryWhen } from 'rxjs/operators'
import makeWebSocketObservable, {
    GetWebSocketResponses
} from 'rxjs-websockets';

import hmacSHA512 from 'crypto-js/hmac-sha512';
import hex from 'crypto-js/enc-hex';
import { Payload } from "src/interfaces/payload.model";
import { ApiKeyService } from "src/input/apikey.service";

@Injectable()
export class OrderSocketService {

    private apiKey = '9IbqglN2L8hLKVuvh4O49WDA5iYNpOtbWcY4bMV6all'
    private apiSecret = ''

    public input$ = new Subject<string>()
    private socket$ = makeWebSocketObservable('wss://api.bitfinex.com/ws/2')

    public messages$: Observable<WebSocketPayload> = this.socket$.pipe(
        // the observable produces a value once the websocket has been opened
        switchMap((getResponses: GetWebSocketResponses) => {
            console.log('order websocket opened')
            return getResponses(this.input$)
        }),
        share(),
    )

    constructor(private apiKeyService: ApiKeyService) {
        this.auth()
    }

    public auth(): void {
        const payload = this.apiKeyService.getAuthPayload()
        this.setSubscription(payload)
    }

    public setSubscription(payload: Payload): void {
        const msg = this.getSubscribeMessage(payload)
        this.input$.next(msg)
    }

    private getSubscribeMessage(payload): string {
        return JSON.stringify(payload)
    }


}

export type WebSocketPayload = string | ArrayBuffer | Blob