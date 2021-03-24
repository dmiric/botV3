import { Entity, Column, PrimaryColumn, Index } from 'typeorm';


@Entity()
export class Candle  {
    @PrimaryColumn()
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
