import { Entity, Column } from 'typeorm';
import { BuyOrder } from './buyOrder.entity';

@Entity()
export class BuyOrderRev extends BuyOrder {
    @Column()
    updateTime: number;
}