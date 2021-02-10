import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import HmacSHA384 from 'crypto-js/hmac-sha384';
import hex from 'crypto-js/enc-hex';
import { Payload } from "src/interfaces/payload.model";


@Injectable()
export class ApiKeyService {
    
    private payload: Payload;
    private cryptoXlsDir = path.join(os.homedir(),'Documents','Crypto')

    private fileAccess(filePath: string): boolean {
        fs.access(filePath, fs.constants.F_OK, function (err) {
            if(err) {
                throw new Error("Can not access key.txt file:" + err);
            } 
        });

        return true;
    }

    private readFile(): string[] {
        const fileName = 'key.txt'
        const filePath = path.join(this.cryptoXlsDir, fileName)

        if(this.fileAccess(filePath)) {
          let rawData = fs.readFileSync(filePath, "utf8");
          rawData = rawData.replace(/(\r\n|\n|\r)/gm,"");
          return rawData.split(',')      
        }
    }

    public getAuthPayload(): Payload {
        if(this.payload) {
            return this.payload
        }

        const apiKeys = this.readFile()
        const authNonce = Date.now() * 1000 // Generate an ever increasing, single use value. (a timestamp satisfies this criteria)
        const authPayload = 'AUTH' + authNonce // Compile the authentication payload, this is simply the string 'AUTH' prepended to the nonce value
        const authSig = HmacSHA384(authPayload, apiKeys[1]).toString(hex) // The authentication payload is hashed using the private key, the resulting hash is output as a hexadecimal string
        const apiKey = apiKeys[0]

        this.payload = {
            apiKey, //API key
            authSig, //Authentication Sig
            authNonce,
            authPayload,
            event: 'auth', // The connection event, will always equal 'auth'
            //dms: 4, // Optional Dead-Man-Switch flag to cancel all orders when socket is closed
            //filter: [] // Optional filter for the account info received (default = everything)
        }

        return this.payload
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public restAuth(apiPath: string, body: any) {
        const apiKeys = this.readFile()
        const nonce = (Date.now() * 1000).toString() // Standard nonce generator. Timestamp * 1000
        const signature = `/api/${apiPath}${nonce}${JSON.stringify(body)}` 
        // Consists of the complete url, nonce, and request body

        const sig = HmacSHA384(signature, apiKeys[1]).toString()

        return {
            'Content-Type': 'application/json',
            'bfx-nonce': nonce,
            'bfx-apikey': apiKeys[0],
            'bfx-signature': sig
        }
    }

}
