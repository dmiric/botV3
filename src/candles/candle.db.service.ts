import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryBuilder, Repository } from 'typeorm';
import { Candle } from './models/candle.entity';

@Injectable()
export class CandleDbService {

    constructor(
        @InjectRepository(Candle) private repository: Repository<Candle>
    ) { }

    async create(candle: Candle): Promise<Candle> {
        return await this.repository.save(candle)
    }

    async save(candle: Candle): Promise<Candle> {
        return await this.repository.save(candle)
    }

    getQueryBuilder(): QueryBuilder<Candle> {
        return this.repository.createQueryBuilder()
    }
}
