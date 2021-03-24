import { TradeSystemRules } from '../../tradesystem/models/tradesystem.rules.entity';
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, ManyToMany, JoinTable } from 'typeorm';
import { StateMachine } from 'typeorm-state-machine'

@StateMachine([
    {
        stateField: 'status',
        transitions: [
            { name: 'init', from: 'new', to: 'initialising' },
            { name: 'activate', from: 'initialising', to: 'active' },
            { name: 'pause', from: ['active', 'initialising'], to: 'paused' },
            { name: 'complete', from: ['active', 'initialising', 'paused'], to: 'completed' },
        ]
    },
])
@Entity()
export class TradeSession implements TradeSession {
    @PrimaryGeneratedColumn()
    id?: number;

    @Column()
    startTime: number;

    @Column({nullable: true})
    endTime?: number;

    @Column()
    status: string;

    @Column()
    timeframe: string;

    @Column()
    symbol: string;

    @Column({nullable: true})
    positionId?: number; // Idish actually

    @Column()
    startBalance: number;

    @Column({nullable: true})
    investment?: number;

    @Column()
    safeDistance: number;

    @Column()
    strategy: string;

    @Column()
    exchange: string;

    @Column({nullable: true})
    priceDiff?: number;

    @Column({nullable: true})
    priceDiffLow?: string;

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

    @ManyToOne(() => TradeSystemRules, {eager: true})
    buyRules: TradeSystemRules;

    @ManyToOne(() => TradeSystemRules, {eager: true})
    sellRules: TradeSystemRules;

    @ManyToMany(() => TradeSystemRules, {eager: true})
    @JoinTable()
    salesRules?: TradeSystemRules[];
}

export interface TradeSession {
    init?(): void;
    activate?(): void;
    pause?(): void;
    complete?(): void;
}