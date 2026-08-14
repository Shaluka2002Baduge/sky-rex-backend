import express from "express";

import {
    createOrder,
    getOrders,
    updateOrderStatus
} from "../controllers/orderController.js";


const orderRouter = express.Router();


// Create order
orderRouter.post(
    "/",
    createOrder
);


// Get orders
orderRouter.get(
    "/",
    getOrders
);


// Update order status
// Example:
// PUT /api/orders/status/CBC0000001
orderRouter.put(
    "/status/:orderID",
    updateOrderStatus
);


export default orderRouter;