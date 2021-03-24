import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';
import { Order } from './order';
import { StateMachine } from 'typeorm-state-machine'
import { BuyOrder } from './buyOrder.entity';

@StateMachine([
    {
        stateField: 'status',
        transitions: [
            { name: 'send', from: ['new', 'failed'], to: 'sent' },
            { name: 'recieve', from: ['sent', 'failed'], to: 'recieved' },            
            { name: 'confirm', from: 'recieved', to: 'confirmed' },          
            { name: 'partialyFill', from: ['recieved', 'confirmed'], to: 'partialyFilled' },
            { name: 'fill', from: ['recieved', 'partialyFilled', 'confirmed'], to: 'filled' },
            { name: 'cancel', from: ['new', 'sent', 'partialyFilled', 'confirmed', 'failed'], to: 'canceled' },
            { name: 'fail', from: 'sent', to: 'failed' },
        ]
    },
])
@Entity()
export class SellOrder extends Order {    
    @Column({nullable: true})
    priceTrailing?: number;

    @Column({nullable: true})
    sellPrice?: number;

    @OneToOne(() => BuyOrder)
    @JoinColumn()
    buyOrder?: BuyOrder
}

export interface SellOrder {
    send?(): Promise<void>;   
    confirm?(): Promise<void>;
    recieve?(): Promise<void>;
    partialyFill?(): Promise<void>;
    fill?(): Promise<void>;
    cancel?(): Promise<void>;
    fail?(): Promise<void>;
}
