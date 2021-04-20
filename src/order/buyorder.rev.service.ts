import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryBuilder, Repository } from 'typeorm';
import { BuyOrderRev } from './models/buyOrder.rev.entity';

@Injectable()
export class BuyOrderRevService {

    constructor(
        @InjectRepository(BuyOrderRev) private repository: Repository<BuyOrderRev>
    ) { }

    async create(buyOrder: BuyOrderRev): Promise<BuyOrderRev> {
        return await this.repository.save(buyOrder);
    }

    getQueryBuilder(): QueryBuilder<BuyOrderRev> {
        return this.repository.createQueryBuilder()
    }
}
