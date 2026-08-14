import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
    {
        productID: {
            type: String,
            required: true
        },

        quantity: {
            type: Number,
            required: true,
            min: 1
        },

        name: {
            type: String,
            required: true
        },

        price: {
            type: Number,
            required: true
        },

        image: {
            type: String,
            default: ""
        }
    },
    {
        _id: false
    }
);


const orderSchema = new mongoose.Schema({

    orderID: {
        type: String,
        required: true,
        unique: true
    },

    items: {
        type: [orderItemSchema],
        required: true
    },

    customerName: {
        type: String,
        required: true
    },

    email: {
        type: String,
        required: true
    },

    phone: {
        type: String,
        default: "Not provided"
    },

    address: {
        type: String,
        required: true
    },

    total: {
        type: Number,
        required: true
    },

    date: {
        type: Date,
        default: Date.now
    },

    status: {
        type: String,
        default: "Pending"
    }

});


const Order = mongoose.model("Order", orderSchema);

export default Order;