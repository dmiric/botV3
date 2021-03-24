import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm'

@Entity()
export class TradeSystemRules {
    @PrimaryGeneratedColumn()
    id?: number

    @Column({ type: "text" })
    rules: string

    @Column({ type: "text" })
    type: string
}