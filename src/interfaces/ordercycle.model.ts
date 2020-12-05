import { Order } from "./order.model";

export interface OrderCycle {
    buyOrders: Order[];
    sellOrder: Order;
    totalAmount: number,
    totalValue: number
}