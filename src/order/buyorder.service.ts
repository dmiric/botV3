import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryBuilder, Repository } from 'typeorm';
import { BuyOrder } from './models/buyOrder.entity';
import { UpdateResult, DeleteResult } from 'typeorm';

@Injectable()
export class BuyOrderService {

    constructor(
        @InjectRepository(BuyOrder) private repository: Repository<BuyOrder>
    ) { }

    async findByIds(ids: number[]): Promise<BuyOrder[]> {
        return await this.repository.findByIds(ids)
    }

    async findAll(): Promise<BuyOrder[]> {
        return await this.repository.find();
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    async find(options: any): Promise<BuyOrder[]> {
        return await this.repository.find(options);
    }

    async create(buyOrder: BuyOrder): Promise<BuyOrder> {
        return await this.repository.save(buyOrder);
    }

    async update(buyOrder: BuyOrder): Promise<UpdateResult> {
        return await this.repository.update(buyOrder.id, buyOrder);
    }

    async delete(id: number): Promise<DeleteResult> {
        return await this.repository.delete(id);
    }

    getQueryBuilder(): QueryBuilder<BuyOrder> {
        return this.repository.createQueryBuilder()
    }
}
