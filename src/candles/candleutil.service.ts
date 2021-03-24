import { Injectable } from '@nestjs/common';
import { candleWidth } from 'bfx-hf-util'

const _last = require('lodash/last')
const _isFinite = require('lodash/isFinite')

@Injectable()
export class CandleUtilService {
    alignPast(tf: string, mts: number): number {
        let aligned = this.alignRangeMts(tf, mts)
        if (aligned > mts) {
            aligned = aligned - candleWidth(tf)
        }
        return aligned
    }

    alignFuture(tf: string, mts: number): number {
        let aligned = this.alignRangeMts(tf, mts)
        if (aligned <= mts) {
            aligned = aligned + candleWidth(tf)
        }
        return aligned
    }

    /**
     * Rounds the timestamp to the nearest 1m/5m/1h/etc (0 sec & 0 ms)
     *
     * @param {string} tf - candle time frame to use for alignment
     * @param {number} mts
     * @return {number} aligned - rounded to nearest candle width
     */
    alignRangeMts(tf = '', mts: number): number {
        const alignedMTS = new Date(mts)
        const suffix = _last(tf)
        const alignTo = Number(tf.substring(0, tf.length - 1))

        if (!_isFinite(alignTo)) {
            throw new Error('invalid alignment value.')
        }

        alignedMTS.setSeconds(0) // no sec granularity
        alignedMTS.setMilliseconds(0)

        if (suffix === 'm') {
            const min = alignedMTS.getUTCMinutes()
            alignedMTS.setUTCMinutes(min - (min % alignTo))
        } else if (suffix === 'h') {
            alignedMTS.setUTCMinutes(0)

            const hours = alignedMTS.getUTCHours()
            alignedMTS.setUTCHours(hours - (hours % alignTo))
        } else if (suffix === 'D') {
            alignedMTS.setUTCHours(0)

            const date = alignedMTS.getUTCDate()
            alignedMTS.setUTCDate(date - (date % alignTo))
        } else if (suffix === 'M') {
            alignedMTS.setUTCDate(1)
            const month = alignedMTS.getUTCMonth()
            alignedMTS.setUTCMonth(month - (month % alignTo))
        }

        return Number(alignedMTS)
    }

    public calcCandleNumber(start: number, end: number, timeframe: string): number {
        return (end - start) / candleWidth(timeframe)
    }

}
