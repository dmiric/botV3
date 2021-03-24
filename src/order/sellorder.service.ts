import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, QueryBuilder } from 'typeorm';
import { SellOrder } from './models/sellOrder.entity';
import { UpdateResult, DeleteResult } from 'typeorm';

@Injectable()
export class SellOrderService {

    constructor(
        @InjectRepository(SellOrder) private repository: Repository<SellOrder>
    ) { }

    async findByIds(ids: number[]): Promise<SellOrder[]> {
        return await this.repository.findByIds(ids)
    }

    async findAll(): Promise<SellOrder[]> {
        return await this.repository.find();
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    async find(options: any): Promise<SellOrder[]> {
        return await this.repository.find(options);
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    async findCustom(options: any): Promise<SellOrder[]> {
        return await this.repository.find({ price: LessThanOrEqual(options.price), gid: options.gid, status: options.status });
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    async findCustom2(options: any): Promise<SellOrder[]> {
        return await this.repository.find({ candleMts: LessThanOrEqual(options.candleMts), gid: options.gid, status: options.status });
    }

    async create(order: SellOrder): Promise<SellOrder> {
        return await this.repository.save(order);
    }

    async update(order: SellOrder): Promise<UpdateResult> {
        return await this.repository.update(order.id, order);
    }

    async delete(id: number): Promise<DeleteResult> {
        return await this.repository.delete(id);
    }

    getQueryBuilder(): QueryBuilder<SellOrder> {
        return this.repository.createQueryBuilder()
    }
}
