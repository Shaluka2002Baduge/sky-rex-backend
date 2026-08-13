import Order from "../models/order.js";

export async function createOrder(req, res) {

    // if (req.user == null) {
    //     res.status(401).json({
    //         message: "Unauthorized user"
    //     });
    //     return;
    // }

    try {

        const orderList = await Order.find()
            .sort({ date: -1 })
            .limit(1);

        let newOrderID = "CBC0000001";

        if (orderList.length != 0) {

            let lastOrderIDInString = orderList[0].orderID;

            let lastOrderNumberInString =
                lastOrderIDInString.replace("CBC", "");

            let lastOrderNumber =
                parseInt(lastOrderNumberInString);

            let newOrderNumber =
                lastOrderNumber + 1;

            let newOrderNumberInString =
                newOrderNumber.toString().padStart(7, "0");

            newOrderID =
                "CBC" + newOrderNumberInString;
        }

        const newOrder = new Order({

            orderID: newOrderID,

            items: [],

            customerName: req.body.customerName,

            email: req.body.email,

            phone: req.body.phone,

            address: req.body.address,

            total: req.body.total,


        });

        const savedOrder = await newOrder.save();

        res.status(201).json({
            message: "Order created successfully",
            order: savedOrder
        });

    } catch (err) {

        console.log(err);

        res.status(500).json({
            message: "Internal server error"
        });
    }
}