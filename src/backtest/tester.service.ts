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
import { BencBehaviourService } from 'src/behaviour/bencbehaviour.service'
import { EmaService } from 'src/indicators/indicators/ema.service'


@Injectable()
export class TesterService {

    private sold = 0;
    private count = 0;
    private bought = 0;

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

    testingCycle(key: Key, recruise = 0): void {
        this.logService.setKey(key)
        const indicatorOffset = key.indicatorOffset

        if (recruise == 0) {
            this.orderCycleService.setCurrentTimeFrame(key.timeframe)
            this.indicatorService.init(indicatorOffset)
        }

        const candles = this.testDataService.getCandles(key);

        let candleSet: Candle[] = [];
        const endDate = key.end

        for (const candle of candles) {
            this.logService.newLine()
            const currentCandle = this.parseCandlesService.convertToObject(candle)
            this.indicatorService.update(currentCandle.close)
            const lastCandle = this.parseCandlesService.convertToObject(candles[candles.length - 1])
            // console.log(currentCandle.mts)

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

            // check if we reached end date
            if (endDate < currentCandle.mts) {
                this.logService.writeXls()
                return;
            }

            // last candle in stack we need to get next file
            if (lastCandle.mts == currentCandle.mts) {
                const alignedTimeStamp = this.candleUtilService.alignFuture(this.orderCycleService.getCurrentTimeFrame(), currentCandle.mts)
                
                const newKey: Key = {
                    trade: "trade",
                    timeframe: this.orderCycleService.getCurrentTimeFrame(),
                    symbol: key.symbol,
                    indicatorOffset: 0,
                    start: alignedTimeStamp,
                    end: key.end
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
            if (this.orderCycleService.getSellOrder()) {
                const sellOrder = this.orderCycleService.getSellOrder()
                if (currentCandle.high > sellOrder.price) {
                    this.orderCycleService.sellOrderSold()
                    //console.log(new Date(currentCandle.mts).toISOString())
                    candleSet = []
                    this.logService.setData([sellOrder.price, ++this.sold], ['so_price', 'c_sells'])
                }
            }

            // check if we reached conditions for buying a set buy order
            if (this.orderCycleService.getLastUnFilledBuyOrderId()) {
                const buyOrderCid = this.orderCycleService.getLastUnFilledBuyOrderId()
                const buyOrder = this.orderCycleService.getBuyOrderByCid(buyOrderCid)
                if (currentCandle.low < buyOrder.price) {
                    this.orderCycleService.buyOrderBought(buyOrder)
                    candleSet = []
                    this.logService.setData([++this.bought], ['bob_count'])
                    console.log(new Date(currentCandle.mts))
                }
            }

            // conditions that determine setting a new buy order
            candleSet = this.parseCandlesService.handleCandleStream([candle], key, candleSet)
            if (candleSet && candleSet.length > 1 && !this.orderCycleService.getLastUnFilledBuyOrderId()) {
                const orderId = this.behaviorService.nextOrderIdThatMatchesRules(candleSet)
                // await new Promise(r => setTimeout(r, 500));
                if (orderId) {
                    const order = { ...this.ordersService.getOrder(orderId) }

                    let buyPrice = this.behaviorService.getBuyOrderPrice(candleSet)

                    if (order.cid == 101) {
                        buyPrice = currentCandle.open
                    }

                    this.orderCycleService.addBuyOrder(order, buyPrice)
                    this.orderCycleService.timeFrameChanged()

                    if (order.cid == 101) {
                        const buyOrder = this.orderCycleService.getBuyOrderByCid(101)
                        this.orderCycleService.buyOrderBought(buyOrder)
                        this.logService.setData([++this.bought], ['bob_count'])
                    }

                    this.logService.setData([
                        candleSet[0].mts,
                        orderId,
                        buyPrice,
                        ++this.count], ['candle_set_start', 'bo_cid', 'bo_price', 'c_buys'])

                    candleSet = []
                    if (this.orderCycleService.timeFrameChanged() && endDate > currentCandle.mts) {
                        const alignedTimeStamp = this.candleUtilService.alignPast(key.timeframe, currentCandle.mts)

                        const newKey: Key = {
                            trade: "trade",
                            timeframe: this.orderCycleService.getLastOrderTimeFrame(), // should be first order timeframe
                            symbol: order.symbol,
                            indicatorOffset: indicatorOffset,
                            start: alignedTimeStamp,
                            end: key.end
                        }

                        recruise++
                        this.indicatorService.init(indicatorOffset)
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
}
