import { Injectable } from '@nestjs/common'
import { TestDataService } from './testdata.service'
import { Candle } from '../interfaces/candle.model'

import { Key } from '../interfaces/key.model'
import { ParseCandlesService } from '../candles/parsecandles.service'

import { Order } from '../interfaces/order.model'

import { OrdersService } from '../orders/orders.service';
import { KeyService } from '../candles/key.service';
import { OrderCycleService } from '../orders/ordercycle.service';
import { CandleUtilService } from '../candles/candleutil.service';
import { LogService } from '../log/log.service'
import { BencBehaviourService } from '../behaviour/bencbehaviour.service'
import { EmaService } from '../indicators/indicators/ema.service'


@Injectable()
export class TesterService {

    private state = {}

    constructor(
        private testDataService: TestDataService,
        private parseCandlesService: ParseCandlesService,
        private orderCycleService: OrderCycleService,
        private behaviorService: BencBehaviourService,
        private ordersService: OrdersService,
        private candleUtilService: CandleUtilService,
        private keyService: KeyService,
        private logService: LogService,
        private indicatorService: EmaService
    ) {
    }

    testingCycle(key: Key, recruise = 0): null {

        //const indicatorOffset = key.indicatorOffset

        if (recruise == 0) {
            this.orderCycleService.setCurrentTimeFrame(key)
            this.orderCycleService.setCurrentBalance(key)
            this.state[key.id] = {}
            this.state[key.id].bought = 0
            this.state[key.id].sold = 0
            this.state[key.id].count = 0
            //this.indicatorService.init(indicatorOffset)
        }

        const candles = this.testDataService.getCandles(key);

        let candleSet: Candle[] = [];
        const endDate = key.end

        for (const candle of candles) {

            this.logService.newLine(key)
            const currentCandle = this.parseCandlesService.convertToObject(candle)
            // this is a questionable hack to sort out missing candles
            if (!currentCandle) {
                console.log(key)
                throw new Error("Borked!");
                //console.log("Results from: " + new Date(key.logDates[0]) + ' to ' + new Date(key.logDates[1]))
            }
            //this.indicatorService.update(currentCandle.close)
            const lastCandle = this.parseCandlesService.convertToObject(candles[candles.length - 1])
            /*
                        this.logService.setData([
                            currentCandle.mts,
                            new Date(currentCandle.mts),
                            currentCandle.open,
                            currentCandle.close,
                            currentCandle.high,
                            currentCandle.low,
                            this.indicatorService.getResult(),
                            key.timeframe
                        ], ['mts', 'datetime', 'open', 'close', 'high', 'low', 'indicator', 'timeframe'], 0)
            */
            this.logService.setData(key, [
                currentCandle.mts,
                new Date(currentCandle.mts).toLocaleString(),
                currentCandle.open,
                currentCandle.close,
                currentCandle.high,
                currentCandle.low,
                key.timeframe
            ], ['mts', 'datetime', 'open', 'close', 'high', 'low', 'timeframe'], 0)

            // check if we reached end date
            if (endDate < currentCandle.mts) {
                this.logService.writeXls(key)
                return
            }

            // last candle in stack we need to get next file
            if (lastCandle.mts == currentCandle.mts) {
                const alignedTimeStamp = this.candleUtilService.alignFuture(this.orderCycleService.getCurrentTimeFrame(key), currentCandle.mts)

                const newKey: Key = {
                    ...key,
                    timeframe: this.orderCycleService.getCurrentTimeFrame(key),
                    indicatorOffset: 0,
                    start: alignedTimeStamp,
                }

                recruise++
                //process.nextTick(() => {
                setTimeout(() => { this.testingCycle(newKey, recruise) }, 10)
                //})
                return
            }

            // we don't go furter if we didn't yet finish calculating the indicator (ema)
            if (currentCandle.mts < key.start) {
                continue
            }

            // check if sell order is executed
            if (this.orderCycleService.getSellOrder(key)) {
                const sellOrder = this.orderCycleService.getSellOrder(key)
                if (currentCandle.high > sellOrder.price) {

                    const trailingPrice = currentCandle.high - ((currentCandle.high - sellOrder.price) / 1.2);
                    this.logService.setData(key, [trailingPrice], ['so_tr_price'])

                    if (trailingPrice > sellOrder.meta.trailingPrice) {
                        this.orderCycleService.setSellOrderTrailingPrice(key, trailingPrice)

                    } else {
                        this.orderCycleService.sellOrderSold(key, currentCandle.high)

                        //console.log(new Date(currentCandle.mts).toISOString())
                        candleSet = []
                        this.logService.setData(key, [sellOrder.price, ++this.state[key.id].sold], ['so_price', 'c_sells'])
                    }
                    //console.log("Sell: " + new Date(currentCandle.mts))
                    //console.log(this.currentEstimate)
                }
            }

            // check if we reached conditions for buying a set buy order
            if (this.orderCycleService.getLastUnFilledBuyOrderId(key)) {
                const buyOrderCid = this.orderCycleService.getLastUnFilledBuyOrderId(key)
                const buyOrder = this.orderCycleService.getBuyOrderByCid(key, buyOrderCid)
                if (currentCandle.low < buyOrder.price) {
                    this.orderCycleService.buyOrderBought(key, buyOrder)
                    candleSet = []
                    this.logService.setData(key, [++this.state[key.id].bought], ['bob_count'])
                    //console.log("Buy: " + new Date(currentCandle.mts))
                }
            }

            // conditions that determine setting a new buy order
            candleSet = this.parseCandlesService.handleCandleStream([candle], key, candleSet)
            if (candleSet && candleSet.length > 1 && !this.orderCycleService.getLastUnFilledBuyOrderId(key)) {
                const orderId = this.behaviorService.nextOrderIdThatMatchesRules(candleSet, key)
                // await new Promise(r => setTimeout(r, 500));
                if (orderId) {
                    let buyPrice = this.behaviorService.getBuyOrderPrice(candleSet)
                    const order = { ...this.ordersService.getOrder(key, orderId, buyPrice) }

                    if (order.cid == 101) {
                        buyPrice = currentCandle.open
                    }

                    this.orderCycleService.addBuyOrder(key, order, buyPrice)
                    this.orderCycleService.timeFrameChanged(key)

                    if (order.cid == 101) {
                        const buyOrder = this.orderCycleService.getBuyOrderByCid(key, 101)
                        this.orderCycleService.buyOrderBought(key, buyOrder)
                        this.logService.setData(key, [++this.state[key.id].bought], ['bob_count'])
                    }

                    this.logService.setData(key, [
                        candleSet[0].mts,
                        orderId,
                        buyPrice,
                        ++this.state[key.id].count], ['candle_set_start', 'bo_cid', 'bo_price', 'c_buys'])

                    candleSet = []
                    if (this.orderCycleService.timeFrameChanged(key) && endDate > currentCandle.mts) {
                        const alignedTimeStamp = this.candleUtilService.alignPast(key.timeframe, currentCandle.mts)

                        const newKey: Key = {
                            ...key,
                            timeframe: this.orderCycleService.getLastOrderTimeFrame(key), // should be first order timeframe
                            //indicatorOffset: indicatorOffset,
                            indicatorOffset: 0,
                            start: alignedTimeStamp
                        }

                        recruise++
                        //this.indicatorService.init(indicatorOffset)
                        //process.nextTick(() => {
                        setTimeout(() => { this.testingCycle(newKey, recruise) }, 10)
                        //})
                        return
                    }
                }
            }
        }

        return
    }

    /*
    private getTimeEstimate(perfTime: number, candleCount): void {
        const totalIterations = this.estCandleNum / 100;
        const est = ((perfTime - this.estTimeStart) / 60000) / candleCount;
        this.currentEstimate = `This could around ${(est * (totalIterations - candleCount)).toFixed(2)} more minutes.`;
    }
    */
}
