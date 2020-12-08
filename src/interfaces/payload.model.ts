export interface Payload {
    apiKey: string; //API key
    authSig: string; //Authentication Sig
    authNonce: number;
    authPayload: string;
    event: string;
    dms?: number; // Optional Dead-Man-Switch flag to cancel all orders when socket is closed
    //filter: [] // Optional filter for the account info received (default = everything)
}