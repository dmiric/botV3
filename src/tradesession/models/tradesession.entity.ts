import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export class TradeSession {
    @PrimaryGeneratedColumn()
    id?: number;

    @Column('datetime')
    startTime: Date;

    @Column('datetime', {nullable: true})
    endTime?: Date;

    @Column()
    status: string;

    @Column()
    timeframe: string;

    @Column()
    symbol: string;

    @Column()
    startBalance: number;

    @Column()
    safeDistance: number;

    @Column({nullable: true})
    originalTrailingProfit?: number;

    @Column({nullable: true})
    originalTrailingDistance?: number;

    @Column({nullable: true})
    overrideTrailingProfit?: number;

    @Column({nullable: true})
    overrideTrailingDistance?: number;

    @Column({nullable: true})
    closePercent?: number;
}
/*
export interface Key {
    id?: string;
    action: string;
    logDates?: number[];
    trade: string;
    timeframe?: string;
    symbol: string;
    indicatorOffset?: number;
    start?: number;
    end?: number;
    orderlimit?: number;
    startBalance?: number;
    safeDistance?: number;
    trailingProfit?: number;
    trailingDistance?: number;
    closePercent?: number;
  }
  */