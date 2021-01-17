import { Injectable } from "@nestjs/common"
import { Subject, Observable, timer } from 'rxjs'
import { share, switchMap, retryWhen, delayWhen } from 'rxjs/operators'
import makeWebSocketObservable, {
    GetWebSocketResponses
} from 'rxjs-websockets'

import { Payload } from "src/interfaces/payload.model"
import { ApiKeyService } from "src/input/apikey.service"
import { Order, ApiOrder } from '../interfaces/order.model'
import { Key } from "src/interfaces/key.model"

@Injectable()
export class OrderSocketService {

    public input$ = new Subject<string>()
    private socket$ = makeWebSocketObservable('wss://api.bitfinex.com/ws/2')
    private socketReady = false;

    public messages$: Observable<WebSocketPayload> = this.socket$.pipe(
        // the observable produces a value once the websocket has been opened
        switchMap((getResponses: GetWebSocketResponses) => {
            console.log('order websocket opened')
            return getResponses(this.input$)
        }),
        share(),
        retryWhen(errors => errors.pipe( delayWhen(() => timer(1000)) )),
    )

    constructor(private apiKeyService: ApiKeyService) {
        this.auth()
    }

    public auth(): void {
        const payload = this.apiKeyService.getAuthPayload()
        this.send(payload)
    }

    public closePosition(key: Key, amount: number): void {
        const order: Order =  {
            cid: Date.now(),
            type: "MARKET",
            symbol: key.symbol,
            amount: amount - (2 * amount),
            meta: { aff_code: "uxiQm6DLx" }
        }

        this.makeOrder(order)
    }

    
    public makeTrailingOrder(key: Key, amount: number, priceTrailing: number): void {
        const order: Order =  {
            cid: Date.now(),
            type: "TRAILING STOP",
            symbol: key.symbol,
            amount: amount - (2 * amount),
            price_trailing: priceTrailing,
            meta: { aff_code: "uxiQm6DLx" }
        }

        this.makeOrder(order)
        
    }

    public makeOrder(order: Order): void{
        const apiOrder = this.prepareApiOrder(order)
        const inputPayload = [0, 'on', null, apiOrder] // Note how the payload is constructed here. It consists of an array starting with the CHANNEL_ID, TYPE, and PLACEHOLDER and is followed by the inputDetails object.
        console.log(inputPayload)
        this.send(inputPayload)
    }

    public requestReqcalc(key: Key): void  {
        const inputPayload = [0, 'calc', null, [["position_" + key.symbol]]] // Note how the payload is constructed here. It consists of an array starting with the CHANNEL_ID, TYPE, and PLACEHOLDER and is followed by the inputDetails object.
        this.send(inputPayload)
    }

    public cancelOrder(id: number): void {
        const inputPayload = [0, 'oc', null, { id: id }]
        console.log(inputPayload)
        this.send(inputPayload)
    }

    public getSocketReadyState(): boolean {
        return this.socketReady;
    }

    public setReadyState(state: boolean): void {
        this.socketReady = state
    }

    private prepareApiOrder(order: Order): ApiOrder {
        const apiOrder = {
            cid: order.cid,
            type: order.type,
            symbol: order.symbol,
            amount: order.amount.toFixed(4),
            meta: { ...order.meta }
        }

        // orders that don't have price are switched to MARKET order
        if(order.hasOwnProperty('price')) {
            apiOrder['price'] = order.price.toFixed(2)
        } else {
            if(apiOrder.type == 'LIMIT') {
                apiOrder.type = 'MARKET'
            }
        }

        if(order.hasOwnProperty('price_trailing')) {
            apiOrder['price_trailing'] = order.price_trailing.toFixed(2)
        }

        return apiOrder;
    }

    private send(payload: Payload|any): void {
        const msg = this.stringify(payload)
        this.input$.next(msg)
    }

    private stringify(payload: Payload|any): string {
        return JSON.stringify(payload)
    }

}

export type WebSocketPayload = string | ArrayBuffer | Blob