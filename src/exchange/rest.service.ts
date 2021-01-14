import { Injectable } from '@nestjs/common'
import fetch from 'node-fetch'

import { Order } from '../interfaces/order.model'
import { ApiKeyService } from "src/input/apikey.service"
import { Key } from '../interfaces/key.model'

@Injectable()
export class RestService {

    constructor(private apiKeyService: ApiKeyService) {
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
        console.log(res)
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