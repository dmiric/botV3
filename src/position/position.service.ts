import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Position } from './models/position.entity';
import { UpdateResult, DeleteResult } from  'typeorm';

@Injectable()
export class PositionService { 

    constructor(@InjectRepository(Position)
    private positionRepository: Repository<Position>) {
    }

    async  findAll(): Promise<Position[]> {
        return await this.positionRepository.find();
    }

    async  create(contact: Position): Promise<Position> {
        return await this.positionRepository.save(contact);
    }

    async update(contact: Position): Promise<UpdateResult> {
        return await this.positionRepository.update(contact.id, contact);
    }

    async delete(id): Promise<DeleteResult> {
        return await this.positionRepository.delete(id);
    }
}
