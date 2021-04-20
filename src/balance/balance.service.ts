import { Injectable } from '@nestjs/common';
import { SellOrderBLService } from 'src/order/sellorder.bl.service';
import { TradeSession } from 'src/tradesession/models/tradesession.entity';
import { WalletService } from 'src/wallet/wallet.service';

@Injectable()
export class BalanceService {
    private balance = {
        balance: null,
        percent: null,
        reserveAmount: null
    }

    constructor(
        private readonly sellOrderBLService: SellOrderBLService,
        private readonly walletService: WalletService
    ) { }

    check(tradeSession: TradeSession, amount: number, estPrice: number, buyPercent: number): boolean {
        const priceDiffLow = JSON.parse(tradeSession.priceDiffLow)
        const useReserve = buyPercent >= priceDiffLow.low ? true : false
        this.set(tradeSession, priceDiffLow)
        const potentialValue = amount * estPrice

        if (useReserve) {
            if (this.balance.balance + this.balance.reserveAmount - potentialValue >= 1) return false
            if (potentialValue >= this.walletService.get('USD')) return false
        }

        if (this.balance.balance - potentialValue >= 1) return false
        if (potentialValue >= this.walletService.get('USD')) return false

        return true
    }

    async update(tradeSession: TradeSession): Promise<void> {
        const sellOrderQB1 = this.sellOrderBLService.getQueryBuilder()
        const sellTotal = await sellOrderQB1
            .select("ROUND(SUM(bo.amount*bo.price))", "total")
            .innerJoin("SellOrder.buyOrder", "bo")
            .where("SellOrder.gid = :gid", { gid: tradeSession.id })
            .andWhere("bo.status = :status1", { status1: "filled" })
            .andWhere("SellOrder.status = :status2", { status2: "new" })
            .getRawOne()

        const requiredReserve = this.calcReserveAmount(tradeSession)
        const potentialBalance = tradeSession.startBalance - requiredReserve - sellTotal.total

        if (potentialBalance <= 0) {
            this.balance.reserveAmount = requiredReserve + potentialBalance
            this.balance.balance = 0
        } else {
            this.balance.balance = potentialBalance
        }

        this.balance.percent = this.balance.balance / (tradeSession.startBalance - requiredReserve)
    }

    getPercent(): number {
        return this.balance.percent
    }

    private set(tradeSession: TradeSession, priceDiffLow: any) {
        let reserveAmount = 0
        if (priceDiffLow) reserveAmount = this.calcReserveAmount(tradeSession, priceDiffLow)

        if (this.balance.balance == null) {
            this.balance.balance = tradeSession.startBalance - reserveAmount
            this.balance.percent = 1 // decimal
            this.balance.reserveAmount = reserveAmount
        }
    }

    private calcReserveAmount(tradeSession: TradeSession, priceDiffLow?: any): number {
        if (!priceDiffLow) priceDiffLow = JSON.parse(tradeSession.priceDiffLow)
        if (!priceDiffLow.hasOwnProperty('reserve')) return 0

        const buyRules = JSON.parse(tradeSession.buyRules.rules)
        const reserve = buyRules[priceDiffLow.low] * tradeSession.investment * priceDiffLow.reserve
        return reserve
    }


}
