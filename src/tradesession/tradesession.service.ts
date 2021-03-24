import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryBuilder, Repository } from 'typeorm';
import { TradeSession } from './models/tradesession.entity';
import { UpdateResult, DeleteResult } from  'typeorm';

@Injectable()
export class TradeSessionService {

    constructor(
        @InjectRepository(TradeSession) private repository: Repository<TradeSession>
    ) { }

    async findByIds(ids: number[]): Promise<TradeSession[]> {
        return await this.repository.findByIds(ids)
    }

    async findLastActiveBySymbol(symbol: string): Promise<TradeSession[]> {
        return await this.repository.find({ where: { symbol: symbol,  status: 'active' } })
    }

    async findAll(): Promise<TradeSession[]> {
        return await this.repository.find();
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    async find(options: any): Promise<TradeSession[]> {
        return await this.repository.find(options);
    }

    async create(tradeSession: TradeSession): Promise<TradeSession> {
        return await this.repository.save(tradeSession);
    }

    async update(tradeSession: TradeSession): Promise<TradeSession> {
        return await this.repository.save(tradeSession);
    }

    async delete(id: number): Promise<DeleteResult> {
        return await this.repository.delete(id);
    }

    getQueryBuilder(): QueryBuilder<TradeSession> {
        return this.repository.createQueryBuilder()
    }


}
