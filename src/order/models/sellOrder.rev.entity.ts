import { Entity, Column } from 'typeorm';
import { SellOrder } from './sellOrder.entity';

@Entity()
export class SellOrderRev extends SellOrder {
    @Column()
    updateTime: number;
}