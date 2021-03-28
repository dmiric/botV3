import { Entity, Column, Index, PrimaryGeneratedColumn } from 'typeorm';


@Entity()
export class Candle  {
    @PrimaryGeneratedColumn()
    id?: number;

    @Column()
    @Index()
    mts: number;

    @Column()
    open: number;

    @Column()
    close: number;

    @Column()
    high: number;

    @Column()
    low: number;

    @Column()
    volume: number;

    @Column()
    @Index()
    symbol: string;

    @Column()
    @Index()
    timeframe: string;
}
