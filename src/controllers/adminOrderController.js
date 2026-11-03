"use strict";

const mongoose = require("mongoose");
const Order = require("../models/orderModel");

const allowedTransitions = {
    PENDING: ["CONFIRMED", "CANCELLED"],
    CONFIRMED: ["SHIPPED", "CANCELLED"],
    SHIPPED: ["DELIVERED"],
    DELIVERED: [],
    CANCELLED: []
};

// GET /admin/orders/api
exports.getAllOrders = async (req, res) => {
    try {
        const orders = await Order.find()
            .populate("user", "userName userEmail")
            .sort({ createdAt: -1 })
            .lean();

        return res.json({
            success: true,
            orders
        });
    } catch (error) {
        console.error("Get all orders error:", error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// GET /admin/orders/api/:orderId
exports.getOrderDetails = async (req, res) => {
    try {
        const { orderId } = req.params;

        if (!mongoose.isValidObjectId(orderId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid order ID."
            });
        }

        const order = await Order.findById(orderId)
            .populate("user", "userName userEmail")
            .lean();

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found."
            });
        }

        return res.json({
            success: true,
            order
        });
    } catch (error) {
        console.error("Get order details error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to load order details."
        });
    }
};

// PATCH /admin/orders/api/:orderId/status
exports.updateOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { orderStatus } = req.body;

        if (!mongoose.isValidObjectId(orderId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid order ID."
            });
        }

        const validStatuses = [
            "PENDING",
            "CONFIRMED",
            "SHIPPED",
            "DELIVERED",
            "CANCELLED"
        ];

        if (!validStatuses.includes(orderStatus)) {
            return res.status(400).json({
                success: false,
                message: "Invalid order status."
            });
        }

        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found."
            });
        }

        const currentStatus = order.orderStatus;

        if (currentStatus === orderStatus) {
            return res.json({
                success: true,
                message: "Order already has this status.",
                order
            });
        }

        const nextStatuses = allowedTransitions[currentStatus] || [];

        if (!nextStatuses.includes(orderStatus)) {
            return res.status(400).json({
                success: false,
                message:
                    `Cannot change order status from ${currentStatus} to ${orderStatus}.`
            });
        }

        order.orderStatus = orderStatus;
        await order.save();

        return res.json({
            success: true,
            message: `Order status updated to ${orderStatus}.`,
            order
        });
    } catch (error) {
        console.error("Update order status error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to update order status."
        });
    }
};

// Get the logged-in user's order history
exports.getMyOrders = async (req, res) => {
    try {
        const userId = req.user._id.user?.id;

        console.log("SESSION USER:", req.user._id.user);
        console.log("SESSION USER ID:", userId);

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "User session not found."
            });
        }

        // Debug: find all orders, regardless of owner
        const allOrders = await Order.find()
            .select("_id user orderStatus createdAt")
            .lean();

        console.log("ALL ORDER OWNERS:", allOrders.map(order => ({
            orderId: String(order._id),
            userId: String(order.user),
            status: order.orderStatus
        })));

        // Actual user's orders
        const orders = await Order.find({ user: userId })
            .sort({ createdAt: -1 })
            .lean();

        console.log("ORDERS MATCHING SESSION:", orders.length);

        return res.json({
            success: true,
            orders
        });
    } catch (error) {
        console.error("Get my orders error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to load your orders."
        });
    }
};
