import { ObjectMeta } from "./objectmeta.model";

export interface Order {
    cid: number;
    type: string;
    amount: number; // should be string when sending to bfx
    symbol: string;
    price?: number; // should be string when sending to bfx
    status?: string;
    meta?: ObjectMeta;
  }

export interface ApiOrder {
    cid: number;
    type: string;
    amount: string; // should be string when sending to bfx
    symbol: string;
    price: string; // should be string when sending to bfx
    meta?: ObjectMeta;
}