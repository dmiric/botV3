import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryBuilder, Repository } from 'typeorm';
import { SellOrderRev } from './models/sellOrder.rev.entity';

@Injectable()
export class SellOrderRevService {

    constructor(
        @InjectRepository(SellOrderRev) private repository: Repository<SellOrderRev>
    ) { }

    async create(sellOrder: SellOrderRev): Promise<SellOrderRev> {
        return await this.repository.save(sellOrder);
    }

    getQueryBuilder(): QueryBuilder<SellOrderRev> {
        return this.repository.createQueryBuilder()
    }
}

