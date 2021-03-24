import { Injectable } from '@nestjs/common'

import { TradeSessionBLService } from 'src/tradesession/tradesession.bl.service';
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { BuyOrderService } from 'src/order/buyorder.service';
import { SellOrderService } from 'src/order/sellorder.service';
import { CandleDbService } from 'src/candles/candle.db.service';


@Injectable()
export class StrategyTwoReportService {

    constructor(
        private readonly tradeSessionBLService: TradeSessionBLService,
        private readonly buyOrderService: BuyOrderService,
        private readonly sellOrderService: SellOrderService,
        private readonly candleDbService: CandleDbService
    ) { }

    async report(tradeSessionId: number): Promise<any> {
        dayjs.extend(utc)
        const tradeSession = await this.tradeSessionBLService.findById(tradeSessionId)

        const startYear = dayjs.utc(tradeSession.startTime).year()
        const startMonth = dayjs.utc(tradeSession.startTime).month() + 1

        const date1 = dayjs.utc(tradeSession.startTime)
        const date2 = dayjs.utc(tradeSession.endTime)
        const diff = date2.diff(date1, 'week')

        const periods = []
        periods.push(["1-" + startMonth + '-' + startYear, date1.valueOf()])

        for (let m = 1; m <= diff; m++) {
            const next = dayjs.utc(date1).add(m, 'week')
            periods[m - 1] = [periods[m - 1][0], periods[m - 1][1], next.valueOf()]
            const nextMonth = dayjs.utc(next).month() + 1
            const nextYear = dayjs.utc(next).year()
            periods.push([m + 1 + "-" + nextMonth + '-' + nextYear, next.valueOf()])
        }

        // removes last we make one more so we can get full data
        periods.pop()

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
                    borderColor: "#cc7178",
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
            // diff
            const buyOrderQB = this.buyOrderService.getQueryBuilder()
            const buy = await buyOrderQB
                .select("ROUND(SUM(amount*price))", "total")
                .addSelect("ROUND(SUM(amount*price) * 0.002)", "fees")
                .addSelect("ROUND(SUM(amount), 4)", "amount")
                .where("candleMts > :startTime AND candleMts < :endTime", { startTime: tradeSession.startTime, endTime: period[2] })
                .andWhere("gid = :gid", { gid: tradeSession.id })
                .andWhere("status = :status", { status: "filled" })
                .getRawOne()

            const buyOrderQB2 = this.buyOrderService.getQueryBuilder()
            const buyPrice = await buyOrderQB2
                .select("ROUND(SUM(amount*price)/SUM(amount), 4)", "total")
                .where("candleMts > :startTime AND candleMts < :endTime", { startTime: tradeSession.startTime, endTime: period[2] })
                .andWhere("gid = :gid", { gid: tradeSession.id })
                .andWhere("status = :status", { status: "filled" })
                .getRawOne()

            const buyOrderQB4 = this.buyOrderService.getQueryBuilder()
            const periodPrice = await buyOrderQB4
                .select("ROUND(SUM(price*amount), 4)", "avgPrice")
                .addSelect("ROUND(MAX(price), 4)", "maxPrice")
                .addSelect("ROUND(MIN(price), 4)", "minPrice")
                .addSelect("SUM(amount)", "amount")
                .addSelect("COUNT(id)", "count")
                .where("candleMts > :startTime AND candleMts < :endTime", { startTime: period[1], endTime: period[2] })
                .andWhere("gid = :gid", { gid: tradeSession.id })
                .andWhere("status = :status", { status: "filled" })
                .getRawOne()

            const candleQB = this.candleDbService.getQueryBuilder()
            const candles = await candleQB
                .select("ROUND(AVG(close), 4)", "avgPrice")
                .addSelect("ROUND(MAX(close), 4)", "maxPrice")
                .addSelect("ROUND(MIN(close), 4)", "minPrice")
                .addSelect("ROUND(MIN(low), 4)", "lowPrice")
                .where("mts >= :startTime AND mts <= :endTime", { startTime: period[1], endTime: period[2] })
                .getRawOne()

            const buyOrderQB7 = this.buyOrderService.getQueryBuilder()
            const periodDips = await buyOrderQB7
                .select("COUNT( tradeSystemGroup )", "count")
                .addSelect("tradeSystemGroup", "percent")
                .where("candleMts > :startTime AND candleMts < :endTime", { startTime: period[1], endTime: period[2] })
                .andWhere("gid = :gid", { gid: tradeSession.id })
                .andWhere("status = :status", { status: "filled" })
                .groupBy("tradeSystemGroup")
                .getRawMany()

            const sellOrderQB = this.sellOrderService.getQueryBuilder()
            const sell = await sellOrderQB
                .select("ROUND(SUM(amount*price) - SUM(amount*price)*2 )", "total")
                .addSelect("ROUND((SUM(amount*price) - SUM(amount*price)*2) * 0.002 )", "fees")
                .addSelect("ROUND(SUM( amount-(amount*2) ), 4)", "amount")
                .where("candleMts > :startTime AND candleMts < :endTime", { startTime: tradeSession.startTime, endTime: period[2] })
                .andWhere("gid = :gid", { gid: tradeSession.id })
                .andWhere("status = :status", { status: "filled" })
                .getRawOne()

            /*    
            const sellOrderQB2 = this.sellOrderService.getQueryBuilder()
            const sellAll = await sellOrderQB2
                .select("ROUND( SUM(SellOrder.amount*SellOrder.price) - SUM(SellOrder.amount*SellOrder.price)*2 )", "total")
                .addSelect("ROUND( SUM(SellOrder.amount*SellOrder.price) - SUM(SellOrder.amount*SellOrder.price)*2 ) * 0.002", "fees")
                .addSelect("ROUND(AVG(SellOrder.price), 4)", "sellPrice")
                .innerJoinAndSelect("SellOrder.buyOrder", "bo", "bo.id = SellOrder.buyOrder")
                .where("bo.candleMts > :startTime AND bo.candleMts < :endTime", { startTime: tradeSession.startTime, endTime: period[2] })
                .andWhere("SellOrder.gid = :gid", { gid: tradeSession.id })
                .andWhere("bo.status = :status", { status: "filled" })
                .getRawOne()
            */

            const sellOrderQB3 = this.sellOrderService.getQueryBuilder()
            const sellAll2 = await sellOrderQB3
                .select("bo.price", "price")
                .addSelect("bo.tradeSystemGroup", "priceDiff")
                .addSelect("bo.amount", "amount")
                .innerJoinAndSelect("SellOrder.buyOrder", "bo", "bo.id = SellOrder.buyOrder")
                .where("bo.candleMts > :startTime AND bo.candleMts < :endTime", { startTime: tradeSession.startTime, endTime: period[2] })
                .andWhere("SellOrder.gid = :gid", { gid: tradeSession.id })
                .andWhere("bo.status = :status", { status: "filled" })
                .getRawMany()

            let sellAllTotal = 0
            let sellAllTotalAmount = 0
            for (const sa of sellAll2) {
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

        const tradeSessionQB = this.tradeSessionBLService.getQueryBuilder()
        const sessions = await tradeSessionQB
            .select("*")
            .addSelect("(endTime-startTime) / 1000 / 60 / 60 / 24 / 30", "duration")
            .where("strategy = :strategy", { strategy: tradeSession.strategy })
            .andWhere("status = :status", { status: "completed" })
            .orderBy("id", "DESC")
            .limit(20)
            .getRawMany()

        return {
            data: { trades: trades, prices: prices, accumulated: accumulated, orders: cleanOrders },
            tradeSession: tradeSession,
            tradeSessions: sessions
        }

    }

    private cleanDips(orders) {
        for (const [i, dataset] of orders.datasets.entries()) {
            if (!dataset) {
                continue
            }
            if (dataset.hasOwnProperty('data') && dataset.data.reduce((a, b) => a + b) == 0) {
                orders.datasets.splice(i, 1);
                this.cleanDips(orders)
            }
        }

        return orders
    }
}