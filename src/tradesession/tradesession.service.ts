import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TradeSession } from './models/tradesession.entity';
import { UpdateResult, DeleteResult } from  'typeorm';

@Injectable()
export class TradeSessionService {

    constructor(
        @InjectRepository(TradeSession) private positionRepository: Repository<TradeSession>
    ) { }

    async findAll(): Promise<TradeSession[]> {
        return await this.positionRepository.find();
    }

    async create(tradeSession: TradeSession): Promise<TradeSession> {
        return await this.positionRepository.save(tradeSession);
    }

    async update(tradeSession: TradeSession): Promise<UpdateResult> {
        return await this.positionRepository.update(tradeSession.id, tradeSession);
    }

    async delete(id: number): Promise<DeleteResult> {
        return await this.positionRepository.delete(id);
    }
}
