import { Injectable } from "@nestjs/common";
import { TradeSession } from '../tradesession/models/tradesession.entity'
import WebSocket from "ws";
import { ApiKeyService } from "../input/apikey.service";
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { Cron } from '@nestjs/schedule';

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
    ) {
        if (this.sockets.candleSocket) {
            this.sockets.candleSocket.on("message", (message: string) => {

                this.botQueue.add(
                    'candles',
                    { message: message },
                    { removeOnComplete: true }
                )

                this.lastCandleSocketTime = 0
            }
            );
        }

        if (this.sockets.orderSocket) {
            this.sockets.orderSocket.on("message", (message: string) => {
                this.botQueue.add(
                    'trade',
                    { message: message },
                    { removeOnComplete: true, delay: 50 }
                )

                this.lastOrderSocketTime = Date.now()
            }
            );
        }
    }

    @Cron('59 * * * * *')
    handleCron(): void {
        if (this.lastOrderSocketTime == 0 && this.lastCandleSocketTime == 0) {
            return
        }

        if(!this.tradeSession) {
            return
        }

        const posDelay = Math.floor((Date.now() - this.lastOrderSocketTime) / 1000)
        if (posDelay > 60) {
            console.log("reconnecting to order socket" + this.lastOrderSocketTime)
            const payload = this.apiKeyService.getAuthPayload()
            this.send('orderSocket', payload)
        }

        const candleDelay = Math.floor((Date.now() - this.lastCandleSocketTime) / 1000)
        if (candleDelay > 60) {
            console.log("reconnecting to candle socket")
            this.setSubscription(this.tradeSession)
        }
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
    open(socket: string, tradeSession: TradeSession): boolean {
        // Wait until the state of the socket is not ready and send the message when it is...
        this.waitForSocketConnection(socket, () => {
            if (socket == 'orderSocket') {
                const payload = this.apiKeyService.getAuthPayload()
                this.send(socket, payload)
                return true
            }

            if (socket == 'candleSocket') {
                this.setSubscription(tradeSession)
                this.tradeSession = tradeSession
                return true
            }
        });

        return
    }

    close(socket: string): void {
        this.sockets[socket].close(1000, 'Normal Closure');
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
