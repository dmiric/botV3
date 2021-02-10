import { Key } from "./key.model";

export interface ObjectMeta {
    aff_code: string;
    timeframe?: string;
    data?: string;
    safeDistance?: number;
    target?: number;
    trailingPrice?: number;
    id?: number;
    key?: Key;
    tradeExecuted?: boolean;
    ex_id?: number;
    tradeTimestamp?: number;
    sentToEx?: boolean;
    exAmount?: number;
    type?: string;
    fee?: number;
  }