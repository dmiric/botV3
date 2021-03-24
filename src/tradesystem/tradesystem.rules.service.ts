import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TradeSystemRules } from './models/tradesystem.rules.entity';
import { UpdateResult, DeleteResult } from  'typeorm';
import { TradeSession } from 'src/tradesession/models/tradesession.entity';

@Injectable()
export class TradeSystemRulesService {

    constructor(
        @InjectRepository(TradeSystemRules) private readonly repository: Repository<TradeSystemRules>
    ) { }

    async getNextTradeSystemGroup(tradeSession: TradeSession, previous: number): Promise<number> {
        const tradeSystemValues = JSON.parse(tradeSession.buyRules.rules)
        if(tradeSystemValues[previous + 1]) {
            return previous + 1
        }
        return 0
    }

    async findByIds(ids: number[]): Promise<TradeSystemRules[]> {
        return await this.repository.findByIds(ids)
    }

    async findAll(): Promise<TradeSystemRules[]> {
        return await this.repository.find()
    }

    async create(tradeSystemRules: TradeSystemRules): Promise<TradeSystemRules> {
        return await this.repository.save(tradeSystemRules)
    }

    async update(tradeSystemRules: TradeSystemRules): Promise<UpdateResult> {
        return await this.repository.update(tradeSystemRules.id, tradeSystemRules)
    }

    async delete(id: number): Promise<DeleteResult> {
        return await this.repository.delete(id)
    }
}
