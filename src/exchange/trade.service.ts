/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Injectable, Inject, Logger, LoggerService } from '@nestjs/common'

import { TradeSession } from '../tradesession/models/tradesession.entity'
import { SocketsService } from './bfx.sockets.service'
import { TradeSessionBLService } from '../tradesession/tradesession.bl.service'
import { SocketFactory } from './socket.factory'
import { StrategyFactory } from './strategy.factory'
import { BackTestDataSource } from '../backtest/btest.datasource.service'
import { Cron } from '@nestjs/schedule'
import { Queue } from 'bull'
import { InjectQueue } from '@nestjs/bull'

@Injectable()
export class TradeService {

    // trade process
    private tradeStatus = false;
    private stoppedManually = false;
    private starting = false;


    private lastSignal: TradeSession;
    private lastSignalTime: string;
    private activeTradeSession: TradeSession;
    private socketsService: SocketsService | BackTestDataSource
    private strategyService = null

    constructor(
        private readonly socketFactory: SocketFactory,
        private readonly strategyFactory: StrategyFactory,
        @Inject(Logger) private readonly logger: LoggerService,
        private readonly tradeSessionBLService: TradeSessionBLService,
        @InjectQueue('bot') private readonly botQueue: Queue
    ) {
        this.botQueue.empty()
    }

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

    async closePosition(tradeSession: TradeSession): Promise<void> {
        //this.setLastSignal(key)

        if (!this.getStatus()) {
            return
        }

        if (this.strategyService.closePosition) {
            await this.strategyService.closePosition(tradeSession)
        }
    }

    async setActiveTradeSession(tradeSession: TradeSession) {
        if (tradeSession.status == 'initialising') {
            tradeSession.activate()
            await this.tradeSessionBLService.save(tradeSession)
        }

        this.activeTradeSession = tradeSession
    }

    getActiveTradeSession(): TradeSession {
        return this.activeTradeSession
    }

    public async trade(tradeSession?: TradeSession): Promise<void> {

        if (!tradeSession) {
            tradeSession = this.getActiveTradeSession()
        } else {
            this.setActiveTradeSession(tradeSession)
        }

        this.socketsService = await this.socketFactory.getService(tradeSession.exchange)
        this.strategyService = await this.strategyFactory.getService(tradeSession.strategy, this.socketsService)

        await this.socketsService.openOrder()
        this.setStatus(true)
        await this.socketsService.openCandle(tradeSession)
    }

    async restartTrade(tradeSession: TradeSession): Promise<void> {
        await this.trade(tradeSession)
    }

    public async stream(message: string): Promise<void> {
        if (!this.getStatus() || this.isStopped() || this.isStarting()) return
        const tradeSession = this.activeTradeSession
        const data = JSON.parse(message)

        if (data == 'end') {
            this.resetTradeProcess(tradeSession)
            return
        }

        // if data[0] == 0 it's authenticated channel
        if (data[0] == 0) {
            // pc: position closed
            if (data[1] == 'pc') {
                if (data[2][0] !== tradeSession.symbol) return
                this.resetTradeProcess(tradeSession)
                return
            }

            if (data[1] == 'pn') {
                if (data[2][0] !== tradeSession.symbol) return
                tradeSession.positionId = data[2][11]
                this.activeTradeSession = await this.tradeSessionBLService.save(tradeSession)
                return
            }

            await this.strategyService.tradeStream(data, tradeSession)
        }

        await this.strategyService.candleStream(message, tradeSession)
    }

    @Cron('45 * * * * *')
    async checkSockets(): Promise<void> {
        if (!this.getStatus() || this.isStopped() || this.isStarting()) return
        if (!this.socketsService) return
        if (this.socketsService.checkActivity()) return        
        if (!this.getStatus()) return
        const tradeSession = this.getActiveTradeSession()
        await this.socketsService.openOrder()
        await this.socketsService.openCandle(tradeSession)
    }

    resetTradeProcess(tradeSession: TradeSession): void {
        this.logger.log("Resetting...", "reset trade process")
        this.socketsService.close()
        this.completeTradeSession(tradeSession)
        this.logger.log(tradeSession)
        this.setStatus(false)
        this.logger.log("Done!", "reset trade process")
    }

    private async completeTradeSession(tradeSession: TradeSession) {
        tradeSession.complete()
        tradeSession.endTime = tradeSession.endTime ? tradeSession.endTime : Date.now()
        await this.tradeSessionBLService.save(tradeSession)
    }

    stopTrade(): string {
        this.logger.log("Stopping...", "manual stop")
        this.socketsService.close()
        this.setStatus(false)

        this.stoppedManually = true
        this.logger.log("Stopped!", "manual stop")
        return "Stopped!"
    }

}
