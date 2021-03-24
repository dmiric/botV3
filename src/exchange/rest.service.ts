import { Injectable } from '@nestjs/common'
import fetch from 'node-fetch'

import { ApiKeyService } from '../input/apikey.service'

@Injectable()
export class RestService {

    constructor(private apiKeyService: ApiKeyService) {
    }

    async getCandleData(pathParamsData: string, startTime: number, endTime: number): Promise<any> {
        // wait 600ms delay so we don't hit the rate limit
        await new Promise(r => setTimeout(r, 600));

        const url = 'https://api-pub.bitfinex.com/v2'

        const pathParams = 'candles/' + pathParamsData + '/hist' // Change these based on relevant path params. /last for last candle
        const queryParams = 'limit=10000&sort=1&start=' + startTime + '&end=' + endTime // Change these based on relevant query params

        try {
            const req = await fetch(`${url}/${pathParams}?${queryParams}`)
            const response = await req.json()
            return response;
        }
        catch (err) {
            console.log(err)
        }
    }

    async fetchOrders(symbol: string, orders = {}, hist = false): Promise<any> {
        let apiPath = `v2/auth/r/orders/${symbol}`
        if(hist) {
            apiPath = apiPath + '/hist'
        }
        return await this.request(apiPath, orders)
    }

    async fetchActivePositions(): Promise<any> {
        const apiPath = 'v2/auth/r/positions'
        const res = await this.request(apiPath)
        return res;
    }

    private async request(apiPath: string, body = {}): Promise<any> {
        const headers = this.apiKeyService.restAuth(apiPath, body)

        try {
            const req = await fetch(`https://api.bitfinex.com/${apiPath}`, {
                method: 'POST',
                body: JSON.stringify({...body
                }),
                headers: {
                    ...headers
                }
            })
            const response = await req.json()
            return response;
        }
        catch (err) {
            console.log(err)
        }
    }
}