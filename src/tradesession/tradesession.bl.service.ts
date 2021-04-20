import { Injectable } from '@nestjs/common';
import { QueryBuilder } from 'typeorm';
import { TradeSession } from './models/tradesession.entity';
import { TradeSessionService } from './tradesession.service';

@Injectable()
export class TradeSessionBLService {

    constructor(
        private readonly tradeSession: TradeSessionService
    ) { }

    async findById(id: number): Promise<TradeSession> {
        const activeTradeSessions = await this.tradeSession.find({ where: {id: id} })
        return activeTradeSessions[0]
    }

    async findLast(): Promise<TradeSession> {
        const activeTradeSessions = await this.tradeSession.find({ order: { id: 'DESC' }, take: 1 })
        return activeTradeSessions[0]
    }

    async findLastActive(): Promise<TradeSession> {
        const activeTradeSessions = await this.tradeSession.find({ where: { status: 'active' }, order: { id: 'DESC' }, take: 1 })
        return activeTradeSessions[0]
    }

    async findLastActiveBySymbolandId(symbol: string, positionId: number): Promise<TradeSession> {
        const activeTradeSessions = await this.tradeSession.find({ 
            where: { symbol: symbol, positionId: positionId, status: 'active' } 
        })
        return activeTradeSessions[0]
    }

    async create(newTradeSession: TradeSession): Promise<TradeSession> {
        const tS = await this.tradeSession.create(newTradeSession)
        const tSessions = await this.tradeSession.findByIds([tS.id])
        return tSessions[0]
    }

    async save(tradeSession: TradeSession): Promise<TradeSession> {
        await this.tradeSession.update(tradeSession)
        const tSessions = await this.tradeSession.findByIds([tradeSession.id])
        return tSessions[0]
    }

    getQueryBuilder(): QueryBuilder<TradeSession> {
        return this.tradeSession.getQueryBuilder()
    }

}
