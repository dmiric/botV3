import { Injectable, Inject, Logger, LoggerService } from '@nestjs/common'

import { TradeSession } from '../tradesession/models/tradesession.entity'
import { SocketsService } from './bfx.sockets.service'
import { TradeSessionBLService } from '../tradesession/tradesession.bl.service'
import { SocketFactory } from './socket.factory'
import { StrategyFactory } from './strategy.factory'
import { BackTestDataSource } from '../backtest/btest.datasource.service';
import { HistCandlesService } from '../candles/hist/histcandles.service'

@Injectable()
export class TradeService {

    // trade process
    private tradeStatus = false;
    private stoppedManually = false;
    private starting = false;

    // signal
    private lastSignal: TradeSession;
    private lastSignalTime: string;
    private lastLongKey: TradeSession;
    private activeTradeSession: TradeSession;


    private socketsService: SocketsService | BackTestDataSource
    private strategyService = null

    constructor(
        private readonly socketFactory: SocketFactory,
        private readonly strategyFactory: StrategyFactory,
        @Inject(Logger) private readonly logger: LoggerService,
        private readonly tradeSessionBLService: TradeSessionBLService,
        private readonly histCandles: HistCandlesService
    ) { }

    async getStatusInfo(): Promise<any> {
        const tradeSession = await this.tradeSessionBLService.findLast()
        return await this.strategyService.getStatusInfo(tradeSession)
    }

    getStatus(): boolean {
        return this.tradeStatus
    }

    setStatus(status: boolean): boolean {
        return this.tradeStatus = status
    }

    setStarting(status: boolean): boolean {
        return this.starting = status
    }

    isStarting(): boolean {
        return this.starting
    }

    isStopped(): boolean {
        return this.stoppedManually
    }

    setLastSignal(tradeSession: TradeSession): void {
        this.lastLongKey = tradeSession

        this.lastSignal = tradeSession;
        const d = new Date();
        this.lastSignalTime = d.toString();

        this.logger.log(this.lastSignal, "signal")
        this.logger.log(this.lastSignalTime, "signal")
    }

    async closePosition(tradeSession: TradeSession): Promise<void> {
        //this.setLastSignal(key)

        if (!this.getStatus()) {
            return
        }

        if (this.strategyService.closePosition) {
            await this.strategyService.closePosition(tradeSession)
        }
    }

    async restartTrade(tradeSession: TradeSession): Promise<void> {
        this.trade(tradeSession)
    }

    setActiveTradeSession(tradeSession: TradeSession): void {
        this.activeTradeSession = tradeSession
    }

    public async trade(tradeSession: TradeSession): Promise<void> {
        if (tradeSession.status == 'initialising') {
            tradeSession.activate()
            await this.tradeSessionBLService.save(tradeSession)
        }

        this.setActiveTradeSession(tradeSession)

        this.socketsService = await this.socketFactory.getService(tradeSession.exchange)
        this.strategyService = await this.strategyFactory.getService(tradeSession.strategy, this.socketsService)

        await this.socketsService.open('orderSocket', tradeSession)
        this.setStatus(true)
        await this.socketsService.open('candleSocket', tradeSession)
    }

    public async tradeStream(message: string): Promise<void> {
        if (!this.getStatus() || this.isStopped() || this.isStarting()) {
            return
        }

        const tradeSession = this.activeTradeSession
        const data = JSON.parse(message)

        await this.strategyService.tradeStream(data, tradeSession)

        // pc: position closed
        if (data[1] == 'pc') {
            if (data[2][0] !== tradeSession.symbol) {
                return
            }

            this.resetTradeProcess(tradeSession)
            return
        }

        if (data[1] == 'pn') {
            if (data[2][0] !== tradeSession.symbol) {
                return
            }

            tradeSession.positionId = data[2][11]
            this.activeTradeSession = await this.tradeSessionBLService.save(tradeSession)
            return
        }
    }

    public async candleStream(message: string): Promise<void> {
        if (!this.getStatus() || this.isStopped() || this.isStarting()) {
            return
        }

        const tradeSession = this.activeTradeSession

        // this serves to end the backtesting sessions
        if (message == 'end') {
            this.resetTradeProcess(tradeSession)
            return
        }

        await this.strategyService.candleStream(message, tradeSession)
    }

    resetTradeProcess(tradeSession: TradeSession): void {
        this.logger.log("Resetting...", "reset trade process")

        // unsub candle stream
        //if (this.candleSubscription !== undefined) {
        //    this.candleSubscription.unsubscribe()
        // }
        tradeSession.complete()
        tradeSession.endTime = tradeSession.endTime ? tradeSession.endTime : Date.now()
        this.tradeSessionBLService.save(tradeSession)

        this.logger.log(tradeSession)

        // set process inactive
        this.setStatus(false)
        this.logger.log("Done!", "reset trade process")
    }

    stopTrade(): string {
        this.logger.log("Stopping...", "manual stop")
        // unsub candle stream
        // T this.candleSubscription.unsubscribe()
        // unsub from order stream
        // T this.orderSubscription.unsubscribe()
        // set process inactive
        this.setStatus(false)

        this.stoppedManually = true
        this.logger.log("Stopped!", "manual stop")
        return "Stopped!"
    }

}
