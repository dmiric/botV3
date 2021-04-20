import { Injectable } from "@nestjs/common";
import { TradeSession } from '../tradesession/models/tradesession.entity'
import WebSocket from "ws";
import { ApiKeyService } from "../input/apikey.service";
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';

@Injectable()
export class SocketsService {

    private socketURLs = {
        candleSocket: "wss://api-pub.bitfinex.com/ws/2",
        orderSocket: "wss://api.bitfinex.com/ws/2"
    }

    private sockets = {
        candleSocket: new WebSocket(this.socketURLs.candleSocket),
        orderSocket: new WebSocket(this.socketURLs.orderSocket)
    }

    private lastOrderSocketTime = 0
    private lastCandleSocketTime = 0

    private tradeSession

    constructor(
        private readonly apiKeyService: ApiKeyService,
        @InjectQueue('bot') private readonly botQueue: Queue
    ) { }

    checkActivity(): boolean {
        if (this.lastOrderSocketTime == 0 && this.lastCandleSocketTime == 0) {
            return true
        }

        if (!this.tradeSession) {
            return true
        }

        const posDelay = Math.floor((Date.now() - this.lastOrderSocketTime) / 1000)
        const candleDelay = Math.floor((Date.now() - this.lastCandleSocketTime) / 1000)
        if (posDelay > 30 || candleDelay > 30) {
            console.log("reconnecting to order socket " + this.lastOrderSocketTime)
            this.close()
            return false
        }

        return true
    }

    // Make the function wait until the connection is made...
    private waitForSocketConnection(socket: string, callback) {
        if (this.sockets[socket] && this.sockets[socket].readyState === 1) {
            callback();
            return
        }
        if (!this.sockets[socket] || this.sockets[socket].readyState > 1) {
            this.sockets[socket] = new WebSocket(this.socketURLs[socket]);
        }

        setTimeout(
            () => {
                if (this.sockets[socket].readyState === 1) {
                    console.log("Connection is made " + socket)
                    if (callback != null) {
                        callback();
                        return
                    }
                } else {
                    console.log("wait for connection " + socket)
                    this.waitForSocketConnection(socket, callback);
                }

            }, 50); // wait 50 milisecond for the connection...
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    send(socket: string, data: any): void {
        // Wait until the state of the socket is not ready and send the message when it is...
        this.waitForSocketConnection(socket, () => {
            console.log(socket + " message sent!!!");
            this.sockets[socket].send(JSON.stringify(data));
        });
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    openCandle(tradeSession: TradeSession): any {
        this.waitForSocketConnection('candleSocket', () => {
            this.sockets.candleSocket.addEventListener("message", (message) => {
                if (!message.hasOwnProperty("data")) {
                    return
                }

                this.botQueue.add(
                    'candles',
                    { message: message.data },
                    { removeOnComplete: true }
                )

                this.lastCandleSocketTime = Date.now()
            });
            this.setSubscription(tradeSession)
            this.tradeSession = tradeSession
        });
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    openOrder(): any {
        // Wait until the state of the socket is not ready and send the message when it is...
        this.waitForSocketConnection('orderSocket', () => {
                this.sockets.orderSocket.addEventListener("message", (message) => {
                    if (!message.hasOwnProperty("data")) {
                        return
                    }

                    this.botQueue.add(
                        'trade',
                        { message: message.data },
                        { removeOnComplete: true }
                    )

                    this.lastOrderSocketTime = Date.now()
                });
                const payload = this.apiKeyService.getAuthPayload()
                this.send('orderSocket', payload)
                return true          
        });
        return
    }

    close(): void {
        this.sockets['orderSocket'].close(1000, 'Normal Closure');
        this.sockets['candleSocket'].close(1000, 'Normal Closure');
    }

    private setSubscription(tradeSession: TradeSession): void {
        let tradeSessionString = "trade:" + tradeSession.timeframe + ":" + tradeSession.symbol

        // use tBTCUSD stream on test server
        if (tradeSession.symbol == 'tTESTBTC:TESTUSD') {
            tradeSessionString = "trade:" + tradeSession.timeframe + ":tBTCUSD"
        }

        const msg = {
            event: 'subscribe',
            channel: 'candles',
            key: tradeSessionString //'trade:TIMEFRAME:SYMBOL'
        }

        this.send('candleSocket', msg)
    }

}
