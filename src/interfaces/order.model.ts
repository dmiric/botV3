import { ObjectMeta } from "./objectmeta.model";

export interface Order {
    cid: number;
    type: string;
    amount: number; // should be string when sending to bfx
    symbol: string;
    price?: number; // should be string when sending to bfx
    status?: string;
    price_trailing?: number;
    meta?: ObjectMeta;
  }

export interface ApiOrder {
    cid: number;
    type: string;
    amount: string; // should be string when sending to bfx
    symbol: string;
    price?: string; // should be string when sending to bfx
    price_trailing?: string;
    meta?: ObjectMeta;
}

//CHANNEL_ID, TYPE, and PLACEHOLDER and is followed by the inputDetails