import Order from "../models/order.js";
import Product from "../models/product.js";
import { isAdmin, isCustomer } from "./userController.js";


// ======================================================
// CREATE ORDER
// ======================================================

export async function createOrder(req, res) {

    try {

        const user = req.user;

        if (user == null) {

            return res.status(401).json({
                message: "Unauthorized user"
            });
        }


        // Get latest order
        const orderList = await Order.find()
            .sort({ date: -1 })
            .limit(1);


        let newOrderID = "CBC0000001";


        if (
            orderList.length !== 0 &&
            orderList[0].orderID
        ) {

            const lastOrderID =
                orderList[0].orderID;

            const lastOrderNumberString =
                lastOrderID.replace("CBC", "");

            const lastOrderNumber =
                parseInt(lastOrderNumberString);


            if (!isNaN(lastOrderNumber)) {

                const newOrderNumber =
                    lastOrderNumber + 1;

                const newOrderNumberString =
                    newOrderNumber
                        .toString()
                        .padStart(7, "0");

                newOrderID =
                    "CBC" + newOrderNumberString;
            }
        }


        // Customer name
        let customerName =
            req.body.customerName;


        if (
            customerName == null ||
            customerName.trim() === ""
        ) {

            customerName =
                `${user.firstName || ""} ${user.lastName || ""}`.trim();


            if (customerName === "") {
                customerName = "Customer";
            }
        }


        // Phone
        let phone =
            req.body.phone;


        if (
            phone == null ||
            phone.toString().trim() === ""
        ) {

            phone = "Not provided";
        }


        // Address
        const address =
            req.body.address;


        if (
            address == null ||
            address.toString().trim() === ""
        ) {

            return res.status(400).json({
                message: "Address is required"
            });
        }


        // Items
        const itemsInRequest =
            req.body.items;


        if (itemsInRequest == null) {

            return res.status(400).json({
                message: "Items are required to place an order"
            });
        }


        if (!Array.isArray(itemsInRequest)) {

            return res.status(400).json({
                message: "Items should be an array"
            });
        }


        if (itemsInRequest.length === 0) {

            return res.status(400).json({
                message: "Cart is empty"
            });
        }


        const itemsToBeAdded = [];

        let total = 0;


        for (
            let i = 0;
            i < itemsInRequest.length;
            i++
        ) {

            const item =
                itemsInRequest[i];


            if (!item.productID) {

                return res.status(400).json({
                    message: "Product ID is required"
                });
            }


            const quantity =
                Number(item.quantity);


            if (
                isNaN(quantity) ||
                quantity <= 0
            ) {

                return res.status(400).json({
                    message:
                        `Invalid quantity for product ${item.productID}`
                });
            }


            const product =
                await Product.findOne({
                    productID:
                        item.productID
                });


            if (product == null) {

                return res.status(400).json({

                    code: "not-found",

                    message:
                        `Product with ID ${item.productID} not found`,

                    productID:
                        item.productID
                });
            }


            if (
                Number(product.stock) <
                quantity
            ) {

                return res.status(400).json({

                    code: "stock",

                    message:
                        `Insufficient stock for product with ID ${item.productID}`,

                    productID:
                        item.productID,

                    availableStock:
                        product.stock
                });
            }


            let productImage = "";


            if (
                Array.isArray(product.images) &&
                product.images.length > 0
            ) {

                productImage =
                    product.images[0];

            } else if (product.image) {

                productImage =
                    product.image;
            }


            itemsToBeAdded.push({

                productID:
                    product.productID,

                quantity:
                    quantity,

                name:
                    product.name,

                price:
                    Number(product.price),

                image:
                    productImage
            });


            total +=
                Number(product.price) *
                quantity;
        }


        const newOrder =
            new Order({

                orderID:
                    newOrderID,

                items:
                    itemsToBeAdded,

                customerName:
                    customerName,

                email:
                    user.email,

                phone:
                    phone,

                address:
                    address,

                total:
                    total
            });


        const savedOrder =
            await newOrder.save();


        return res.status(201).json({

            message:
                "Order created successfully",

            order:
                savedOrder
        });


    } catch (err) {

        console.error(
            "CREATE ORDER ERROR:",
            err
        );


        return res.status(500).json({

            message:
                "Internal server error",

            error:
                err.message
        });
    }
}


// ======================================================
// GET ORDERS
// ======================================================

export async function getOrders(req, res) {

    try {

        if (isAdmin(req)) {

            const orders =
                await Order.find()
                    .sort({ date: -1 });


            console.log(
                "ADMIN ORDERS:",
                orders
            );


            return res.json(orders);

        } else if (isCustomer(req)) {

            const user =
                req.user;


            const orders =
                await Order.find({
                    email: user.email
                })
                    .sort({ date: -1 });


            return res.json(orders);

        } else {

            return res.status(403).json({

                message:
                    "You are not authorized to view orders"
            });
        }


    } catch (error) {

        console.error(
            "GET ORDERS ERROR:",
            error
        );


        return res.status(500).json({

            message:
                "Internal server error",

            error:
                error.message
        });
    }
}


// ======================================================
// UPDATE ORDER STATUS
// ======================================================

export async function updateOrderStatus(req, res) {

    try {

        // Only admin can change status
        if (!isAdmin(req)) {

            return res.status(403).json({
                message:
                    "You are not authorized to update order status"
            });
        }


        // IMPORTANT:
        // This name matches the router:
        // /status/:orderID
        const orderID =
            req.params.orderID;


        const newStatus =
            req.body.status;


        console.log(
            "UPDATE ORDER ID:",
            orderID
        );

        console.log(
            "NEW STATUS:",
            newStatus
        );


        // Validate order ID
        if (
            !orderID ||
            orderID.trim() === ""
        ) {

            return res.status(400).json({
                message: "Order ID is required"
            });
        }


        // Validate status
        if (
            !newStatus ||
            newStatus.toString().trim() === ""
        ) {

            return res.status(400).json({
                message: "Order status is required"
            });
        }


        // Find and update order
        const updatedOrder =
            await Order.findOneAndUpdate(
                {
                    orderID: orderID
                },
                {
                    $set: {
                        status: newStatus
                    }
                },
                {
                    new: true
                }
            );


        // Order doesn't exist
        if (!updatedOrder) {

            return res.status(404).json({
                message: "Order not found"
            });
        }


        console.log(
            "UPDATED ORDER:",
            updatedOrder
        );


        return res.status(200).json({

            message:
                "Order status updated successfully",

            order:
                updatedOrder
        });


    } catch (err) {

        console.error(
            "UPDATE ORDER STATUS ERROR:",
            err
        );


        return res.status(500).json({

            message:
                "Failed to update order status",

            error:
                err.message
        });
    }
}