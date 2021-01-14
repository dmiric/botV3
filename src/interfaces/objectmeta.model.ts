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
  }