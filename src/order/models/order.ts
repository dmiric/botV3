import { Column, Index, PrimaryGeneratedColumn } from 'typeorm';

export abstract class Order {
    @PrimaryGeneratedColumn()
    id?: number;

    @Column({nullable: true})
    exchangeId?: number;

    @Index()
    @Column()
    gid: number; // use for trade session

    @Column()
    cid: number;

    @Column()
    type: string;

    @Column()
    amount: number;

    @Column()
    symbol: string;

    @Column({nullable: true})
    @Index()
    price?: number;

    @Column()
    @Index()
    status: string;

    @Column('int', {nullable: true})
    tradeTime?: number;

    @Column({nullable: true})
    fee?: number;

    @Column()
    source: string; // bot - custom

    @Column({nullable: true})
    @Index()
    candleMts?: number;

    @Column({nullable: true})
    candleOpen?: number;

    @Column({nullable: true})
    candleClose?: number;
}