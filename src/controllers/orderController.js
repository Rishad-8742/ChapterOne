
"use strict";

const mongoose = require("mongoose");
const crypto = require("crypto");

const Book = require("../models/bookModel");
const Order = require("../models/orderModel");
const Coupon = require("../models/couponModel");
const razorpay = require("../config/razorpay");

// VALIDATE SHIPPING ADDRESS

const validateShippingAddress = (shippingAddress) => {
    if (
        !shippingAddress ||
        typeof shippingAddress !== "object" ||
        Array.isArray(shippingAddress)
    ) {
        return "Please provide your shipping details.";
    }

    const fullName = String(shippingAddress.fullName || "").trim();
    const phone = String(shippingAddress.phone || "").trim();
    const address = String(shippingAddress.address || "").trim();
    const city = String(shippingAddress.city || "").trim();
    const pincode = String(shippingAddress.pincode || "").trim();

    if (fullName.length < 2 || fullName.length > 60) {
        return "Enter a valid full name.";
    }

    if (!/^[6-9]\d{9}$/.test(phone)) {
        return "Enter a valid 10-digit Indian mobile number.";
    }

    if (address.length < 10 || address.length > 250) {
        return "Enter a valid delivery address.";
    }

    if (city.length < 2 || city.length > 60) {
        return "Enter a valid city or town.";
    }

    if (!/^\d{6}$/.test(pincode)) {
        return "Enter a valid 6-digit PIN code.";
    }

    return null;
};

// CALCULATE COUPON DISCOUNT

const calculateDiscountFromCoupon = (coupon, subtotal) => {
    let discount = 0;

    if (coupon.discountType === "fixed") {
        discount = coupon.discountValue;
    } else if (coupon.discountType === "percentage") {
        discount = subtotal * (coupon.discountValue / 100);

        if (coupon.maxDiscount !== null) {
            discount = Math.min(discount, coupon.maxDiscount);
        }
    }

    discount = Math.min(discount, subtotal);
    discount = Math.round(discount * 100) / 100;

    const total = Math.round(
        (subtotal - discount) * 100
    ) / 100;

    return {
        discount,
        total
    };
};

// VALIDATE AND CALCULATE COUPON

const calculateCouponDiscount = async (code, subtotal) => {
    if (!code || typeof code !== "string") {
        throw new Error("Please enter a coupon code.");
    }

    const couponCode = code.trim().toUpperCase();

    const coupon = await Coupon.findOne({
        code: couponCode
    });

    if (!coupon) {
        throw new Error("Invalid coupon code.");
    }

    const now = new Date();

    if (!coupon.isActive) {
        throw new Error("This coupon is currently inactive.");
    }

    if (now < coupon.startDate) {
        throw new Error("This coupon is not available yet.");
    }

    if (now >= coupon.expiryDate) {
        throw new Error("This coupon has expired.");
    }

    if (coupon.usedCount >= coupon.usageLimit) {
        throw new Error("This coupon has reached its usage limit.");
    }

    if (subtotal < coupon.minPurchase) {
        throw new Error(
            `Minimum purchase of ₹${coupon.minPurchase} is required.`
        );
    }

    const calculation = calculateDiscountFromCoupon(
        coupon,
        subtotal
    );

    return {
        coupon,
        discount: calculation.discount,
        total: calculation.total
    };
};

// CREATE COD ORDER

exports.createCodOrder = async (req, res) => {
    const userId = req.user._id;
    let session;

    try {
        const { shippingAddress, couponCode } = req.body;

        const addressError = validateShippingAddress(shippingAddress);

        if (addressError) {
            return res.status(400).json({
                success: false,
                message: addressError
            });
        }

        const cart = req.user.cart || [];

        if (!cart.length) {
            return res.status(400).json({
                success: false,
                message: "Your cart is empty."
            });
        }

        // Validate cart items
        for (const item of cart) {
            if (
                !mongoose.Types.ObjectId.isValid(item.bookId) ||
                !Number.isSafeInteger(item.quantity) ||
                item.quantity < 1
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Your cart contains an invalid item."
                });
            }
        }

        // Get current book details
        const bookIds = [
            ...new Set(cart.map(item => String(item.bookId)))
        ];

        const books = await Book.find({
            _id: { $in: bookIds }
        }).lean();

        const booksById = new Map(
            books.map(book => [String(book._id), book])
        );

        const orderItems = [];
        let subtotal = 0;

        for (const cartItem of cart) {
            const book = booksById.get(String(cartItem.bookId));

            if (!book) {
                return res.status(400).json({
                    success: false,
                    message: "A book in your cart is no longer available."
                });
            }

            if (
                !Number.isSafeInteger(book.stock) ||
                book.stock < cartItem.quantity
            ) {
                return res.status(409).json({
                    success: false,
                    message: `${book.title} does not have enough stock.`
                });
            }

            if (
                typeof book.price !== "number" ||
                !Number.isFinite(book.price) ||
                book.price < 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: `The price for ${book.title} is invalid.`
                });
            }

            const itemSubtotal = book.price * cartItem.quantity;

            if (
                !Number.isFinite(itemSubtotal) ||
                !Number.isSafeInteger(Math.round(itemSubtotal * 100))
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Unable to calculate your order total."
                });
            }

            subtotal += itemSubtotal;

            orderItems.push({
                book: book._id,
                title: book.title,
                author: book.author,
                image: book.image,
                price: book.price,
                quantity: cartItem.quantity,
                subtotal: itemSubtotal
            });
        }

        subtotal = Math.round(subtotal * 100) / 100;

        if (!Number.isFinite(subtotal) || subtotal <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid order total."
            });
        }

        // Preview coupon validation
        let couponResult = null;

        if (
            typeof couponCode === "string" &&
            couponCode.trim()
        ) {
            try {
                couponResult = await calculateCouponDiscount(
                    couponCode,
                    subtotal
                );
            } catch (error) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }
        }

        const deliveryFee = 0;

        let couponDiscount = 0;
        let totalAmount = subtotal;
        let createdOrder;

        session = await mongoose.startSession();

        // Start transaction
        await session.withTransaction(async () => {
            let claimedCoupon = null;

            // Atomically claim coupon usage
            if (couponResult) {
                const now = new Date();

                claimedCoupon = await Coupon.findOneAndUpdate(
                    {
                        _id: couponResult.coupon._id,
                        isActive: true,
                        startDate: { $lte: now },
                        expiryDate: { $gt: now },
                        minPurchase: { $lte: subtotal },
                        $expr: {
                            $lt: ["$usedCount", "$usageLimit"]
                        }
                    },
                    {
                        $inc: {
                            usedCount: 1
                        }
                    },
                    {
                        new: true,
                        session
                    }
                );

                if (!claimedCoupon) {
                    throw new Error(
                        "This coupon is no longer available or has reached its usage limit."
                    );
                }

                const calculation = calculateDiscountFromCoupon(
                    claimedCoupon,
                    subtotal
                );

                couponDiscount = calculation.discount;
            }

            // Calculate final amount
            totalAmount = Math.round(
                (subtotal + deliveryFee - couponDiscount) * 100
            ) / 100;

            // Reserve stock
            for (const item of orderItems) {
                const result = await Book.updateOne(
                    {
                        _id: item.book,
                        stock: { $gte: item.quantity }
                    },
                    {
                        $inc: {
                            stock: -item.quantity
                        }
                    },
                    { session }
                );

                if (result.modifiedCount !== 1) {
                    throw new Error(
                        `${item.title} is out of stock or has insufficient stock.`
                    );
                }
            }

            // Create order
            const orders = await Order.create(
                [{
                    user: userId,
                    items: orderItems,

                    shippingAddress: {
                        fullName: String(shippingAddress.fullName).trim(),
                        phone: String(shippingAddress.phone).trim(),
                        address: String(shippingAddress.address).trim(),
                        city: String(shippingAddress.city).trim(),
                        pincode: String(shippingAddress.pincode).trim()
                    },

                    subtotal,
                    deliveryFee,
                    totalAmount,

                    coupon: claimedCoupon
                        ? claimedCoupon._id
                        : null,

                    couponCode: claimedCoupon
                        ? claimedCoupon.code
                        : null,

                    couponDiscount,

                    paymentMethod: "COD",
                    paymentStatus: "PENDING",
                    orderStatus: "PENDING"
                }],
                { session }
            );

            createdOrder = orders[0];

            // Clear cart
            req.user.cart = [];

            await req.user.save({ session });
        });

        return res.status(201).json({
            success: true,
            message: "Your order has been placed successfully!",
            orderId: String(createdOrder._id),
            redirectUrl: "/user/orders"
        });

    } catch (error) {
        console.error("Create COD order error:", error);

        if (
            error.message.includes("out of stock") ||
            error.message.includes("insufficient stock") ||
            error.message.toLowerCase().includes("coupon")
        ) {
            return res.status(409).json({
                success: false,
                message: error.message
            });
        }

        return res.status(500).json({
            success: false,
            message: "Unable to place your order. Please try again."
        });

    } finally {
        if (session) {
            await session.endSession();
        }
    }
};

// CREATE RAZORPAY ORDER

exports.createRazorpayOrder = async (req, res) => {
    let claimedCouponId = null;
    let orderSaved = false;

    try {
        const userId = req.user._id;

        const { shippingAddress, couponCode } = req.body;

        const addressError = validateShippingAddress(shippingAddress);

        if (addressError) {
            return res.status(400).json({
                success: false,
                message: addressError
            });
        }

        const cart = req.user.cart || [];

        if (!cart.length) {
            return res.status(400).json({
                success: false,
                message: "Your cart is empty."
            });
        }

        // Validate cart
        for (const item of cart) {
            if (
                !mongoose.Types.ObjectId.isValid(item.bookId) ||
                !Number.isSafeInteger(item.quantity) ||
                item.quantity < 1
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Your cart contains an invalid item."
                });
            }
        }

        // Get current book information
        const bookIds = [
            ...new Set(cart.map(item => String(item.bookId)))
        ];

        const books = await Book.find({
            _id: { $in: bookIds }
        }).lean();

        const booksById = new Map(
            books.map(book => [String(book._id), book])
        );

        const orderItems = [];
        let subtotal = 0;

        for (const cartItem of cart) {
            const book = booksById.get(String(cartItem.bookId));

            if (!book) {
                return res.status(400).json({
                    success: false,
                    message: "A book in your cart is no longer available."
                });
            }

            if (
                !Number.isSafeInteger(book.stock) ||
                book.stock < cartItem.quantity
            ) {
                return res.status(409).json({
                    success: false,
                    message: `${book.title} does not have enough stock.`
                });
            }

            if (
                typeof book.price !== "number" ||
                !Number.isFinite(book.price) ||
                book.price < 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: `The price for ${book.title} is invalid.`
                });
            }

            const itemSubtotal = book.price * cartItem.quantity;

            if (!Number.isSafeInteger(Math.round(itemSubtotal * 100))) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid book price."
                });
            }

            subtotal += itemSubtotal;

            orderItems.push({
                book: book._id,
                title: book.title,
                author: book.author,
                image: book.image,
                price: book.price,
                quantity: cartItem.quantity,
                subtotal: itemSubtotal
            });
        }

        subtotal = Math.round(subtotal * 100) / 100;

        if (!Number.isFinite(subtotal) || subtotal <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid order total."
            });
        }

        const deliveryFee = 0;

        let couponDiscount = 0;
        let claimedCoupon = null;

        // Preview coupon validation
        if (
            typeof couponCode === "string" &&
            couponCode.trim()
        ) {
            try {
                const couponResult = await calculateCouponDiscount(
                    couponCode,
                    subtotal
                );

                // Atomically claim coupon usage
                const now = new Date();

                claimedCoupon = await Coupon.findOneAndUpdate(
                    {
                        _id: couponResult.coupon._id,
                        isActive: true,
                        startDate: { $lte: now },
                        expiryDate: { $gt: now },
                        minPurchase: { $lte: subtotal },
                        $expr: {
                            $lt: ["$usedCount", "$usageLimit"]
                        }
                    },
                    {
                        $inc: {
                            usedCount: 1
                        }
                    },
                    { new: true }
                );

                if (!claimedCoupon) {
                    return res.status(409).json({
                        success: false,
                        message:
                            "This coupon is no longer available or has reached its usage limit."
                    });
                }

                claimedCouponId = claimedCoupon._id;

                const calculation = calculateDiscountFromCoupon(
                    claimedCoupon,
                    subtotal
                );

                couponDiscount = calculation.discount;

            } catch (error) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }
        }

        // Calculate discounted total
        const totalAmount = Math.round(
            (subtotal + deliveryFee - couponDiscount) * 100
        ) / 100;

        const amountInPaise = Math.round(totalAmount * 100);

        if (
            !Number.isSafeInteger(amountInPaise) ||
            amountInPaise <= 0
        ) {
            throw new Error("Invalid order total.");
        }

        // Create Razorpay order
        const razorpayOrder = await razorpay.orders.create({
            amount: amountInPaise,
            currency: "INR",
            receipt: `co_${new mongoose.Types.ObjectId()}`
        });

        // Save pending order in MongoDB
        const order = await Order.create({
            user: userId,
            items: orderItems,

            shippingAddress: {
                fullName: String(shippingAddress.fullName).trim(),
                phone: String(shippingAddress.phone).trim(),
                address: String(shippingAddress.address).trim(),
                city: String(shippingAddress.city).trim(),
                pincode: String(shippingAddress.pincode).trim()
            },

            subtotal,
            deliveryFee,
            totalAmount,

            coupon: claimedCoupon
                ? claimedCoupon._id
                : null,

            couponCode: claimedCoupon
                ? claimedCoupon.code
                : null,

            couponDiscount,

            paymentMethod: "RAZORPAY",
            paymentStatus: "PENDING",
            orderStatus: "PENDING",

            razorpayOrderId: razorpayOrder.id,
            // Payment reservation expires after 15 minutes
            paymentExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
            couponUsageReleased: false
        });

        orderSaved = true;

        return res.status(201).json({
            success: true,
            message: "Payment order created.",
            orderId: String(order._id),
            razorpayOrderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            keyId: process.env.RAZORPAY_KEY_ID
        });

    } catch (error) {
        console.error("Create Razorpay order error:", error);

        // Release coupon if order creation failed
        if (claimedCouponId && !orderSaved) {
            try {
                await Coupon.updateOne(
                    {
                        _id: claimedCouponId,
                        usedCount: { $gt: 0 }
                    },
                    {
                        $inc: { usedCount: -1 }
                    }
                );
            } catch (releaseError) {
                console.error(
                    "Failed to release coupon usage:",
                    releaseError
                );
            }
        }

        return res.status(500).json({
            success: false,
            message: "Unable to start online payment. Please try again."
        });
    }
};


// VERIFY RAZORPAY PAYMENT
exports.verifyRazorpayPayment = async (req, res) => {
    try {
        const userId = req.user._id;

        const {
            orderId,
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        } = req.body;

        // Validate required fields
        if (
            !mongoose.Types.ObjectId.isValid(orderId) ||
            !razorpay_order_id ||
            !razorpay_payment_id ||
            !/^[a-f0-9]{64}$/i.test(razorpay_signature || "")
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid payment verification details."
            });
        }

        const order = await Order.findOne({
            _id: orderId,
            user: userId,
            paymentMethod: "RAZORPAY",
            razorpayOrderId: razorpay_order_id
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found."
            });
        }

        // Handle repeated verification
        if (order.paymentStatus === "PAID") {
            if (order.razorpayPaymentId === razorpay_payment_id) {
                return res.json({
                    success: true,
                    message: "Payment was already verified.",
                    redirectUrl: "/user/orders"
                });
            }

            return res.status(409).json({
                success: false,
                message: "This order has already been paid."
            });
        }

        if (order.paymentStatus !== "PENDING") {
            return res.status(409).json({
                success: false,
                message: "This order cannot be verified."
            });
        }

        // Verify Razorpay signature
        const expectedSignature = crypto
            .createHmac(
                "sha256",
                process.env.RAZORPAY_KEY_SECRET
            )
            .update(
                `${razorpay_order_id}|${razorpay_payment_id}`
            )
            .digest();

        const receivedSignature = Buffer.from(
            razorpay_signature,
            "hex"
        );

        if (
            receivedSignature.length !== expectedSignature.length ||
            !crypto.timingSafeEqual(
                expectedSignature,
                receivedSignature
            )
        ) {
            return res.status(400).json({
                success: false,
                message: "Payment signature verification failed."
            });
        }

        // Confirm payment with Razorpay
        let payment = await razorpay.payments.fetch(
            razorpay_payment_id
        );

        const expectedAmount = Math.round(
            order.totalAmount * 100
        );

        if (
            payment.order_id !== razorpay_order_id ||
            payment.currency !== "INR" ||
            payment.amount !== expectedAmount
        ) {
            return res.status(400).json({
                success: false,
                message: "Payment details do not match the order."
            });
        }

        // Capture authorized payment
        if (payment.status === "authorized") {
            payment = await razorpay.payments.capture(
                razorpay_payment_id,
                expectedAmount,
                "INR"
            );
        }

        if (payment.status !== "captured") {
            return res.status(400).json({
                success: false,
                message: "Payment has not been completed."
            });
        }

        // Reserve stock after successful payment
        const reservedItems = [];

        try {
            for (const item of order.items) {
                const result = await Book.updateOne(
                    {
                        _id: item.book,
                        stock: { $gte: item.quantity }
                    },
                    {
                        $inc: { stock: -item.quantity }
                    }
                );

                if (result.modifiedCount !== 1) {
                    throw new Error(
                        `Insufficient stock for ${item.title}.`
                    );
                }

                reservedItems.push(item);
            }

            order.razorpayPaymentId = razorpay_payment_id;
            order.paymentStatus = "PAID";
            order.orderStatus = "CONFIRMED";

            await order.save();

        } catch (error) {
            // Restore stock if order update fails
            for (const item of reservedItems) {
                await Book.updateOne(
                    { _id: item.book },
                    {
                        $inc: { stock: item.quantity }
                    }
                );
            }

            throw error;
        }

        // Remove purchased quantities from cart
        for (const orderedItem of order.items) {
            const cartItem = req.user.cart.find(
                item =>
                    String(item.bookId) ===
                    String(orderedItem.book)
            );

            if (cartItem) {
                cartItem.quantity -= orderedItem.quantity;
            }
        }

        req.user.cart = req.user.cart.filter(
            item => item.quantity > 0
        );

        await req.user.save();

        return res.json({
            success: true,
            message: "Payment successful!",
            orderId: String(order._id),
            redirectUrl: "/user/orders"
        });

    } catch (error) {
        console.error(
            "Verify Razorpay payment error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to verify payment. Please check your order before retrying."
        });
    }
};

// GET USER ORDER HISTORY

exports.getMyOrders = async (req, res) => {
    try {
        const userId = req.user._id;

        const orders = await Order.find({
            user: userId
        })
            .sort({ createdAt: -1 })
            .select(
                "items shippingAddress subtotal deliveryFee totalAmount coupon couponCode couponDiscount paymentMethod paymentStatus orderStatus createdAt"
            )
            .lean();

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

// CANCEL ORDER

exports.cancelOrder = async (req, res) => {
    let session;

    try {
        const userId = req.user._id;
        const orderId = req.params.orderId;

        // Validate order ID
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid order ID."
            });
        }

        // Find customer's order
        const order = await Order.findOne({
            _id: orderId,
            user: userId
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found."
            });
        }

        if (order.orderStatus === "CANCELLED") {
            return res.status(400).json({
                success: false,
                message: "This order is already cancelled."
            });
        }

        if (!["PENDING", "CONFIRMED"].includes(order.orderStatus)) {
            return res.status(400).json({
                success: false,
                message: "This order can no longer be cancelled."
            });
        }

        if (order.cancellationStatus === "PROCESSING") {
            return res.status(409).json({
                success: false,
                message: "Cancellation is already being processed."
            });
        }

        if (order.cancellationStatus === "COMPLETED") {
            return res.status(400).json({
                success: false,
                message: "This order is already cancelled."
            });
        }

        // Claim cancellation request atomically
        const claimedOrder = await Order.findOneAndUpdate(
            {
                _id: orderId,
                user: userId,
                orderStatus: { $in: ["PENDING", "CONFIRMED"] },
                cancellationStatus: {
                    $nin: ["PROCESSING", "COMPLETED"]
                }
            },
            {
                $set: {
                    cancellationStatus: "PROCESSING",
                    cancellationReason: String(
                        req.body?.reason || "Cancelled by customer"
                    ).trim()
                }
            },
            { new: true }
        );

        if (!claimedOrder) {
            return res.status(409).json({
                success: false,
                message:
                    "Another cancellation request is being processed."
            });
        }

        // Process Razorpay refund for paid orders
        if (
            claimedOrder.paymentMethod === "RAZORPAY" &&
            claimedOrder.paymentStatus === "PAID"
        ) {
            if (!claimedOrder.razorpayPaymentId) {
                throw new Error("Razorpay payment ID is missing.");
            }

            const refundAmount = Math.round(
                claimedOrder.totalAmount * 100
            );

            const refund = await razorpay.payments.refund(
                claimedOrder.razorpayPaymentId,
                {
                    amount: refundAmount,
                    receipt: `cancel_${claimedOrder._id}`,
                    notes: {
                        orderId: String(claimedOrder._id),
                        reason: claimedOrder.cancellationReason
                    }
                }
            );

            claimedOrder.refundId = refund.id;
            claimedOrder.refundStatus = "PROCESSED";

            await claimedOrder.save();
        }

        const shouldRestoreStock =
            claimedOrder.paymentMethod === "COD" ||
            (
                claimedOrder.paymentMethod === "RAZORPAY" &&
                claimedOrder.paymentStatus === "PAID"
            );

        session = await mongoose.startSession();

        await session.withTransaction(async () => {
            const currentOrder = await Order.findOne({
                _id: orderId,
                user: userId
            }).session(session);

            if (!currentOrder) {
                throw new Error(
                    "Order not found during cancellation."
                );
            }

            // Restore stock only once
            if (shouldRestoreStock && !currentOrder.stockRestored) {
                for (const item of currentOrder.items) {
                    const result = await Book.updateOne(
                        { _id: item.book },
                        {
                            $inc: {
                                stock: item.quantity
                            }
                        },
                        { session }
                    );

                    if (result.matchedCount !== 1) {
                        throw new Error(
                            `Book not found: ${item.title}`
                        );
                    }
                }

                currentOrder.stockRestored = true;
            }

            // Release coupon usage inside the transaction
// Release coupon usage only once
if (
    currentOrder.coupon &&
    !currentOrder.couponUsageReleased
) {
    const couponUpdate = await Coupon.updateOne(
        {
            _id: currentOrder.coupon,
            usedCount: { $gt: 0 }
        },
        {
            $inc: {
                usedCount: -1
            }
        },
        { session }
    );

    if (couponUpdate.modifiedCount !== 1) {
        throw new Error(
            "Unable to release coupon usage."
        );
    }

    currentOrder.couponUsageReleased = true;
}
            currentOrder.orderStatus = "CANCELLED";
            currentOrder.cancelledAt = new Date();
            currentOrder.cancellationStatus = "COMPLETED";

            await currentOrder.save({ session });
        });

        return res.status(200).json({
            success: true,
            message: "Your order has been cancelled successfully.",
            orderStatus: "CANCELLED",
            orderId: String(claimedOrder._id),
            refundId: claimedOrder.refundId || null
        });

    } catch (error) {
        console.error("Cancel order error:", error);

        return res.status(500).json({
            success: false,
            message:
                "Cancellation could not be completed. Please contact support before retrying."
        });

    } finally {
        if (session) {
            await session.endSession();
        }
    }
};

// VALIDATE COUPON FOR CHECKOUT

exports.validateCoupon = async (req, res) => {
    try {
        const { code } = req.body;

        const cart = req.user.cart || [];

        if (!cart.length) {
            return res.status(400).json({
                success: false,
                message: "Your cart is empty."
            });
        }

        // Validate cart items
        for (const item of cart) {
            if (
                !mongoose.Types.ObjectId.isValid(item.bookId) ||
                !Number.isSafeInteger(item.quantity) ||
                item.quantity < 1
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Your cart contains an invalid item."
                });
            }
        }

        // Get current book prices
        const bookIds = [
            ...new Set(cart.map(item => String(item.bookId)))
        ];

        const books = await Book.find({
            _id: { $in: bookIds }
        }).lean();

        const booksById = new Map(
            books.map(book => [String(book._id), book])
        );

        let subtotal = 0;

        for (const item of cart) {
            const book = booksById.get(String(item.bookId));

            if (!book) {
                return res.status(400).json({
                    success: false,
                    message:
                        "A book in your cart is no longer available."
                });
            }

            if (
                typeof book.price !== "number" ||
                !Number.isFinite(book.price) ||
                book.price < 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid book price."
                });
            }

            subtotal += book.price * item.quantity;
        }

        subtotal = Math.round(subtotal * 100) / 100;

        if (!Number.isFinite(subtotal) || subtotal <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid cart total."
            });
        }

        // Validate coupon without increasing usage
        const result = await calculateCouponDiscount(
            code,
            subtotal
        );

        return res.status(200).json({
            success: true,
            message: "Coupon applied successfully!",
            coupon: {
                code: result.coupon.code,
                discountType: result.coupon.discountType,
                discountValue: result.coupon.discountValue,
                maxDiscount: result.coupon.maxDiscount
            },
            subtotal,
            discount: result.discount,
            total: result.total
        });

    } catch (error) {
        console.error("Validate coupon error:", error);

        return res.status(400).json({
            success: false,
            message:
                error.message || "Unable to validate coupon."
        });
    }
};
