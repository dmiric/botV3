import { Injectable } from '@nestjs/common'

import { TradeSessionBLService } from '../../tradesession/tradesession.bl.service';
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { BuyOrderService } from '../../order/buyorder.service';
import { SellOrderService } from '../../order/sellorder.service';
import { CandleDbService } from '../../candles/candle.db.service';
import { TradeSession } from '../../tradesession/models/tradesession.entity';


@Injectable()
export class StrategyTwoReportService {

    constructor(
        private readonly tradeSessionBLService: TradeSessionBLService,
        private readonly buyOrderService: BuyOrderService,
        private readonly sellOrderService: SellOrderService,
        private readonly candleDbService: CandleDbService
    ) { }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    async report(tradeSessionId?: number, unit?: any): Promise<any> {
        dayjs.extend(utc)

        let tradeSession
        if (tradeSessionId) {
            tradeSession = await this.tradeSessionBLService.findById(tradeSessionId)
        } else {
            tradeSession = await this.tradeSessionBLService.findLast()
        }

        const startYear = dayjs.utc(tradeSession.startTime).year()
        const startMonth = dayjs.utc(tradeSession.startTime).month() + 1

        const date1 = dayjs.utc(tradeSession.startTime)
        const date2 = dayjs.utc(tradeSession.endTime ? tradeSession.endTime : Date.now())
        const diff = date2.diff(date1, unit)

        const periods = []
        periods.push(["1-" + startMonth + '-' + startYear, date1.valueOf()])

        for (let m = 1; m <= diff; m++) {
            const next = dayjs.utc(date1).add(m, unit)
            periods[m - 1] = [periods[m - 1][0], periods[m - 1][1], next.valueOf()]
            const nextMonth = dayjs.utc(next).month() + 1
            const nextYear = dayjs.utc(next).year()
            periods.push([m + 1 + "-" + nextMonth + '-' + nextYear, next.valueOf()])
        }

        const trades = {
            labels: [],
            datasets: [
                {
                    label: "Position",
                    backgroundColor: "#d4b483",
                    type: "bar",
                    data: []
                },
                {
                    label: "Max Profit",
                    backgroundColor: "#48a9a6",
                    type: "bar",
                    data: []
                },
                {
                    label: "Balance",
                    borderColor: "#e4dfda",
                    type: "line",
                    fill: false,
                    data: []
                }
            ]
        }

        const prices = {
            labels: [],
            datasets: [
                {
                    label: "Average Sell Price",
                    borderColor: "#c1666b",
                    type: "line",
                    fill: false,
                    data: []
                },
                {
                    label: "Average Buy Price",
                    borderColor: "#4281a4",
                    type: "line",
                    fill: false,
                    data: []
                },
                {
                    label: "Period Max. Buy P.",
                    borderColor: "#70566d",
                    type: "line",
                    fill: false,
                    data: []
                },
                {
                    label: "Period Avg. Buy P.",
                    borderColor: "#e4dfda",
                    type: "line",
                    fill: false,
                    data: []
                },
                {
                    label: "Period Min. Buy P.",
                    borderColor: "#cb8d77",
                    type: "line",
                    fill: false,
                    data: []
                },
                {
                    label: "Max. Close Price",
                    borderColor: "#735cdd",
                    type: "line",
                    fill: false,
                    data: []
                },
                {
                    label: "Avg. Close Price",
                    borderColor: "#9000b3",
                    type: "line",
                    fill: false,
                    data: []
                },
                {
                    label: "Min. Close Price",
                    borderColor: "#7e007b",
                    type: "line",
                    fill: false,
                    data: []
                },
                {
                    label: "Lowest Low Price",
                    borderColor: "#b3d89c",
                    type: "line",
                    fill: false,
                    data: []
                }
            ]
        }

        const accumulated = {
            labels: [],
            datasets: [
                {
                    label: "Accumulated",
                    backgroundColor: "#cb8d77",
                    type: "bar",
                    data: []
                }
            ]
        }

        const orders = {
            labels: [],
            datasets: [
                {
                    label: "Buy Count",
                    backgroundColor: "#4281a4",
                    type: "bar",
                    stack: 'Stack 1',
                    data: []
                }
            ]
        }

        for (let i = 1; i < 30; i++) {
            orders.datasets.push({
                label: i + '%',
                type: "bar",
                backgroundColor: 'rgb(' + i * 20 + ', 153, 255)',
                stack: 'Stack 0',
                data: []
            })
            for (let d = 0; d <= diff; d++) {
                orders.datasets[i].data.push(0)
            }
        }

        const sellRules = JSON.parse(tradeSession.sellRules.rules)

        for (const [pi, period] of periods.entries()) {
            if(!period[2]) {
                period[2] = tradeSession.endTime ? tradeSession.endTime : Date.now()
            }
            const buy = await this.buy(tradeSession, period);
            const buyPrice = await this.buyPrice(tradeSession, period);
            const periodPrice = await this.periodPrice(period, tradeSession);
            const candles = await this.candles(period, tradeSession);
            const periodDips = await this.periodDips(period, tradeSession);
            const sell = await this.sell(tradeSession, period);
            const sellAll = await this.sellAll(tradeSession, period);

            let sellAllTotal = 0
            let sellAllTotalAmount = 0
            for (const sa of sellAll) {
                sellAllTotal = sellAllTotal + (sa.price + sa.price * sellRules[sa.priceDiff] * sa.priceDiff / 10000) * sa.amount
                sellAllTotalAmount = sellAllTotalAmount + sa.amount
            }

            trades.datasets[0].data.push(sell.total - buy.total) // Position
            trades.datasets[1].data.push(sellAllTotal - buy.total) // Max Profit +
            trades.datasets[2].data.push(tradeSession.startBalance - buy.total - buy.fees + sell.total - sell.fees) // Balance

            prices.datasets[0].data.push(sellAllTotal / sellAllTotalAmount) // Sell price +
            prices.datasets[1].data.push(buyPrice.total) // Buy price +            
            prices.datasets[2].data.push(periodPrice.maxPrice) // Period Max Price +
            prices.datasets[3].data.push(periodPrice.avgPrice / periodPrice.amount) // Period Avg Price +
            prices.datasets[4].data.push(periodPrice.minPrice) // Period Min Price +
            prices.datasets[5].data.push(candles.maxPrice) // Max Price +
            prices.datasets[6].data.push(candles.avgPrice) // Avg Price +
            prices.datasets[7].data.push(candles.minPrice) // Min Price +
            prices.datasets[8].data.push(candles.lowPrice) // Low Price +

            accumulated.datasets[0].data.push(buy.amount - sell.amount) // Amount
            orders.datasets[0].data.push(periodPrice.count) // Number of orders

            for (const periodDip of periodDips) {
                if (!periodDip.hasOwnProperty('count')) {
                    continue
                }
                orders.datasets[periodDip.percent].data[pi] = periodDip.count; // Dip % Distribution
            }

            trades.labels.push(period[0])
            prices.labels.push(period[0])
            accumulated.labels.push(period[0])
            orders.labels.push(period[0])
        }

        const cleanOrders = this.cleanDips(orders)
        const sessions = await this.tradeSessions(tradeSession);
        const sellOrders = await this.sellOrders(tradeSession);

        return {
            data: { trades: trades, prices: prices, accumulated: accumulated, orders: cleanOrders },
            tradeSession: tradeSession,
            tradeSessions: sessions,
            sellOrders: sellOrders
        }

    }

    private async tradeSessions(tradeSession: any) {
        const tradeSessionQB = this.tradeSessionBLService.getQueryBuilder();
        const sessions = await tradeSessionQB
            .select("*")
            .addSelect("(endTime-startTime) / 1000 / 60 / 60 / 24 / 30", "duration")
            .where("strategy = :strategy", { strategy: tradeSession.strategy })
            .andWhere("status = :status", { status: "completed" })
            .orderBy("id", "DESC")
            .limit(20)
            .getRawMany();
        return sessions;
    }

    private async buy(tradeSession: any, period: any) {
        const buyOrderQB = this.buyOrderService.getQueryBuilder();
        const buy = await buyOrderQB
            .select("ROUND(SUM(amount*price))", "total")
            .addSelect("ROUND(SUM(amount*price) * 0.002)", "fees")
            .addSelect("ROUND(SUM(amount), 4)", "amount")
            .where("candleMts > :startTime AND candleMts < :endTime", { startTime: tradeSession.startTime, endTime: period[2] })
            .andWhere("gid = :gid", { gid: tradeSession.id })
            .andWhere("status = :status", { status: "filled" })
            .getRawOne();
        return buy;
    }

    private async buyPrice(tradeSession: any, period: any) {
        const buyOrderQB2 = this.buyOrderService.getQueryBuilder();
        const buyPrice = await buyOrderQB2
            .select("ROUND(SUM(amount*price)/SUM(amount), 4)", "total")
            .where("candleMts > :startTime AND candleMts < :endTime", { startTime: tradeSession.startTime, endTime: period[2] })
            .andWhere("gid = :gid", { gid: tradeSession.id })
            .andWhere("status = :status", { status: "filled" })
            .getRawOne();
        return buyPrice;
    }

    private async periodPrice(period: any, tradeSession: any) {
        const buyOrderQB4 = this.buyOrderService.getQueryBuilder();
        const periodPrice = await buyOrderQB4
            .select("ROUND(SUM(price*amount), 4)", "avgPrice")
            .addSelect("ROUND(MAX(price), 4)", "maxPrice")
            .addSelect("ROUND(MIN(price), 4)", "minPrice")
            .addSelect("SUM(amount)", "amount")
            .addSelect("COUNT(id)", "count")
            .where("candleMts > :startTime AND candleMts < :endTime", { startTime: period[1], endTime: period[2] })
            .andWhere("gid = :gid", { gid: tradeSession.id })
            .andWhere("status = :status", { status: "filled" })
            .getRawOne();
        return periodPrice;
    }

    private async candles(period: any, tradeSession: any) {
        const candleQB = this.candleDbService.getQueryBuilder();
        const candles = await candleQB
            .select("ROUND(AVG(close), 4)", "avgPrice")
            .addSelect("ROUND(MAX(close), 4)", "maxPrice")
            .addSelect("ROUND(MIN(close), 4)", "minPrice")
            .addSelect("ROUND(MIN(low), 4)", "lowPrice")
            .where("mts >= :startTime AND mts <= :endTime", { startTime: period[1], endTime: period[2] })
            .andWhere("symbol = :symbol", { symbol: tradeSession.symbol })
            .getRawOne();
        return candles;
    }

    private async periodDips(period: any, tradeSession: any) {
        const buyOrderQB7 = this.buyOrderService.getQueryBuilder();
        const periodDips = await buyOrderQB7
            .select("COUNT( tradeSystemGroup )", "count")
            .addSelect("tradeSystemGroup", "percent")
            .where("candleMts > :startTime AND candleMts < :endTime", { startTime: period[1], endTime: period[2] })
            .andWhere("gid = :gid", { gid: tradeSession.id })
            .andWhere("status = :status", { status: "filled" })
            .groupBy("tradeSystemGroup")
            .getRawMany();
        return periodDips;
    }

    private async sell(tradeSession: TradeSession, period: any) {
        const sellOrderQB = this.sellOrderService.getQueryBuilder();
        const sell = await sellOrderQB
            .select("ROUND(SUM(amount*price) - SUM(amount*price)*2 )", "total")
            .addSelect("ROUND((SUM(amount*price) - SUM(amount*price)*2) * 0.002 )", "fees")
            .addSelect("ROUND(SUM( amount-(amount*2) ), 4)", "amount")
            .where("candleMts > :startTime AND candleMts < :endTime", { startTime: tradeSession.startTime, endTime: period[2] })
            .andWhere("gid = :gid", { gid: tradeSession.id })
            .andWhere("status = :status", { status: "filled" })
            .getRawOne();
        return sell;
    }

    private async sellOrders(tradeSession: TradeSession) {
        const sellOrderQB = this.sellOrderService.getQueryBuilder();
        const sell = await sellOrderQB
            .select("bo.*")
            .addSelect("SellOrder.*")
            .addSelect("ROUND(bo.price, 2)", "buyPrice")
            .addSelect("ROUND(SellOrder.price, 2)", "sellPrice")
            .addSelect("DATETIME(ROUND(SellOrder.candleMts / 1000), 'unixepoch')", "sellTime")
            .addSelect("DATETIME(ROUND(bo.candleMts / 1000), 'unixepoch')", "buyTime")
            .innerJoinAndSelect("SellOrder.buyOrder", "bo", "bo.id = SellOrder.buyOrder")
            .where("SellOrder.gid = :gid", { gid: tradeSession.id })
            .getRawMany();
        return sell;
    }

    private async sellAll(tradeSession: TradeSession, period: any) {
        const sellOrderQB = this.sellOrderService.getQueryBuilder();
        const sellAll = await sellOrderQB
            .select("bo.price", "price")
            .addSelect("bo.tradeSystemGroup", "priceDiff")
            .addSelect("bo.amount", "amount")
            .innerJoinAndSelect("SellOrder.buyOrder", "bo", "bo.id = SellOrder.buyOrder")
            .where("bo.candleMts > :startTime AND bo.candleMts < :endTime", { startTime: tradeSession.startTime, endTime: period[2] })
            .andWhere("SellOrder.gid = :gid", { gid: tradeSession.id })
            .andWhere("bo.status = :status", { status: "filled" })
            .getRawMany();
        return sellAll;
    }

    private cleanDips(orders) {
        for (const [i, dataset] of orders.datasets.entries()) {
            if (!dataset) {
                continue
            }
            if (dataset.hasOwnProperty('data') && dataset.data.length > 0 && dataset.data.reduce((a, b) => a + b) == 0) {
                orders.datasets.splice(i, 1);
                this.cleanDips(orders)
            }
        }

        return orders
    }
}