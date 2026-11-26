
"use strict";

const mongoose = require("mongoose");

const Order = require("../models/orderModel");
const Coupon = require("../models/couponModel");
const razorpay = require("../config/razorpay");

// CHECK WHETHER RAZORPAY PAYMENT IS UNSUCCESSFUL
const isPaymentUnsuccessful = async (razorpayOrderId) => {
    try {
        const razorpayOrder = await razorpay.orders.fetch(
            razorpayOrderId
        );

        // Never expire an order that Razorpay reports as paid.
        if (razorpayOrder.status === "paid") {
            return false;
        }

        const paymentResponse =
            await razorpay.orders.fetchPayments(razorpayOrderId);

        const payments = paymentResponse.items || [];

        // Never release coupon usage if a payment is authorized
        // or captured. Authorized payments may still be captured.
        const hasSuccessfulOrPendingPayment = payments.some(
            payment =>
                ["authorized", "captured", "created"].includes(
                    payment.status
                )
        );

        if (hasSuccessfulOrPendingPayment) {
            return false;
        }

        // No payment attempts, or all attempts failed.
        return payments.every(
            payment => payment.status === "failed"
        );

    } catch (error) {
        console.error(
            "Razorpay payment status check failed:",
            error.message
        );

        // If Razorpay cannot confirm the status, do not release
        // the coupon. Safety first.
        return false;
    }
};


// EXPIRE ONE PENDING ORDER
const expireOrder = async (order) => {
    const unsuccessful = await isPaymentUnsuccessful(
        order.razorpayOrderId
    );

    if (!unsuccessful) {
        return;
    }

    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {
            // Claim the order only if it is still pending and expired.
            const currentOrder = await Order.findOne({
                _id: order._id,
                paymentMethod: "RAZORPAY",
                paymentStatus: "PENDING",
                orderStatus: "PENDING",
                paymentExpiresAt: { $lte: new Date() }
            }).session(session);

            if (!currentOrder) {
                return;
            }

            // Release coupon usage exactly once.
            if (
                currentOrder.coupon &&
                !currentOrder.couponUsageReleased
            ) {
                const result = await Coupon.updateOne(
                    {
                        _id: currentOrder.coupon,
                        usedCount: { $gt: 0 }
                    },
                    {
                        $inc: { usedCount: -1 }
                    },
                    { session }
                );

                if (result.modifiedCount !== 1) {
                    throw new Error(
                        "Unable to release expired order coupon usage."
                    );
                }
            }

            currentOrder.couponUsageReleased = true;
            currentOrder.paymentStatus = "FAILED";
            currentOrder.orderStatus = "CANCELLED";
            currentOrder.cancelledAt = new Date();
            currentOrder.cancellationReason =
                "Razorpay payment expired.";
            currentOrder.cancellationStatus = "COMPLETED";

            await currentOrder.save({ session });
        });

    } finally {
        await session.endSession();
    }
};


// FIND AND PROCESS EXPIRED ORDERS
const cleanupExpiredOrders = async () => {
    try {
        const expiredOrders = await Order.find({
            paymentMethod: "RAZORPAY",
            paymentStatus: "PENDING",
            orderStatus: "PENDING",
            paymentExpiresAt: { $lte: new Date() }
        }).limit(50);

        for (const order of expiredOrders) {
            try {
                await expireOrder(order);
            } catch (error) {
                console.error(
                    `Unable to expire order ${order._id}:`,
                    error.message
                );
            }
        }

    } catch (error) {
        console.error(
            "Expired order cleanup error:",
            error
        );
    }
};


// START AUTOMATIC CLEANUP
const startExpiredOrderCleanup = () => {
    console.log("Razorpay expiry cleanup started.");

    // Run once when the server starts.
    cleanupExpiredOrders();

    // Check every minute.
    const interval = setInterval(
        cleanupExpiredOrders,
        60 * 1000
    );

    // Do not keep the Node.js process alive only for this timer.
    if (typeof interval.unref === "function") {
        interval.unref();
    }
};

module.exports = startExpiredOrderCleanup;
