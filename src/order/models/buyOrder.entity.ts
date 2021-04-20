import { Entity, Column, OneToOne } from 'typeorm';
import { Order } from './order';
import { StateMachine } from 'typeorm-state-machine'
import { SellOrder } from './sellOrder.entity';

@StateMachine([
    {
        stateField: 'status',
        transitions: [
            { name: 'send', from: ['new', 'failed'], to: 'sent' },
            { name: 'recieve', from: ['sent', 'failed'], to: 'recieved' },
            { name: 'confirm', from: 'recieved', to: 'confirmed' },
            { name: 'partialyFill', from: ['recieved', 'confirmed', 'canceled'], to: 'partialyFilled' },
            { name: 'fill', from: ['recieved', 'partialyFilled', 'confirmed', 'canceled'], to: 'filled' },
            { name: 'cancel', from: ['new', 'sent', 'recieved', 'confirmed', 'partialyFilled', 'failed'], to: 'canceled' },
            { name: 'fail', from: 'sent', to: 'failed' },
        ]
    },
])
@Entity()
export class BuyOrder extends Order {
    @Column()
    tradeSystemGroup: number;

    @Column()
    startAmount: number;

    @Column()
    boughtAmount: number;

    @OneToOne(() => SellOrder)
    sellOrder?: SellOrder
}

export interface BuyOrder {
    send?(): Promise<void>;   
    confirm?(): Promise<void>;
    recieve?(): Promise<void>;
    partialyFill?(): Promise<void>;
    fill?(): Promise<void>;
    cancel?(): Promise<void>;
    fail?(): Promise<void>;
}
