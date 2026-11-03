"use strict";
const mongoose = require("mongoose");
const crypto = require("crypto");

const Book = require("../models/bookModel");
const Order = require("../models/orderModel");
const razorpay = require("../config/razorpay");

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

// Create a Cash on Delivery order
exports.createCodOrder = async (req, res) => {
    const userId = req.user._id;

    try {
        const { shippingAddress, paymentMethod } = req.body;

        // Validate the shipping details on the server
        if (
            !shippingAddress ||
            typeof shippingAddress !== "object" ||
            Array.isArray(shippingAddress)
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide your shipping details."
            });
        }

        const fullName = String(shippingAddress.fullName || "").trim();
        const phone = String(shippingAddress.phone || "").trim();
        const address = String(shippingAddress.address || "").trim();
        const city = String(shippingAddress.city || "").trim();
        const pincode = String(shippingAddress.pincode || "").trim();

        if (fullName.length < 2 || fullName.length > 60) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid full name."
            });
        }

        if (!/^[6-9]\d{9}$/.test(phone)) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid 10-digit Indian mobile number."
            });
        }

        if (address.length < 10 || address.length > 250) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid delivery address."
            });
        }

        if (city.length < 2 || city.length > 60) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid city or town."
            });
        }

        if (!/^\d{6}$/.test(pincode)) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid 6-digit PIN code."
            });
        }

        if (paymentMethod !== "COD") {
            return res.status(400).json({
                success: false,
                message: "This endpoint currently supports COD only."
            });
        }

        // Read the user's session cart
        const cart = req.user.cart || [];

        if (!cart.length) {
            return res.status(400).json({
                success: false,
                message: "Your cart is empty."
            });
        }

        // Validate every cart item
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

        // Get the current books and prices from MongoDB
        const bookIds = [...new Set(cart.map(item => item.bookId))];

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
                return res.status(400).json({
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

            if (!Number.isFinite(itemSubtotal)) {
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

        if (!Number.isFinite(subtotal)) {
            return res.status(400).json({
                success: false,
                message: "Invalid order total."
            });
        }

        // Delivery is free in this version
        const deliveryFee = 0;
        const totalAmount = subtotal + deliveryFee;

        /*
         * Reserve stock using conditional updates.
         * If any reservation fails, restore stock already reserved.
         */
        const reservedItems = [];

        try {
            for (const item of orderItems) {
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
                        `${item.title} is out of stock or has insufficient stock.`
                    );
                }

                reservedItems.push(item);
            }

            // Save the order only after stock is reserved
            const order = await Order.create({
                user: userId,
                items: orderItems,
                shippingAddress: {
                    fullName,
                    phone,
                    address,
                    city,
                    pincode
                },
                subtotal,
                deliveryFee,
                totalAmount,
                paymentMethod: "COD",
                paymentStatus: "PENDING",
                orderStatus: "PENDING"
            });

            // Clear the cart only after the order has been saved
            req.user.cart = [];
            await req.user.save();

            return res.status(201).json({
                success: true,
                message: "Your order has been placed successfully!",
                orderId: String(order._id),
                redirectUrl: "/user/orders"
            });
        } catch (error) {
            // Restore reserved stock if order creation fails
            for (const item of reservedItems.reverse()) {
                await Book.updateOne(
                    { _id: item.book },
                    { $inc: { stock: item.quantity } }
                );
            }

            if (
                error.message.includes("out of stock") ||
                error.message.includes("insufficient stock")
            ) {
                return res.status(409).json({
                    success: false,
                    message: error.message
                });
            }

            throw error;
        }
    } catch (error) {
        console.error("Create COD order error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to place your order. Please try again."
        });
    }
};


// Create a Razorpay order
exports.createRazorpayOrder = async (req, res) => {
    try {
        const userId = req.user._id;
        const { shippingAddress } = req.body;

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

        // Get current book information from the database
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

        const deliveryFee = 0;
        const totalAmount = subtotal + deliveryFee;
        const amountInPaise = Math.round(totalAmount * 100);

        if (
            !Number.isSafeInteger(amountInPaise) ||
            amountInPaise <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid order total."
            });
        }

        // Create the order with Razorpay
        const razorpayOrder = await razorpay.orders.create({
            amount: amountInPaise,
            currency: "INR",
            receipt: `co_${new mongoose.Types.ObjectId()}`
        });

        // Save a pending order in MongoDB
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
            paymentMethod: "RAZORPAY",
            paymentStatus: "PENDING",
            orderStatus: "PENDING",
            razorpayOrderId: razorpayOrder.id
        });

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

        return res.status(500).json({
            success: false,
            message: "Unable to start online payment. Please try again."
        });
    }
};

// Verify Razorpay payment
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

        // Find the order belonging to this user
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

        // Handle repeated verification requests
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

        // Verify Razorpay's signature
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

        // Confirm payment details directly with Razorpay
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

        // Capture payment if it is authorized but not captured
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

        // Reserve stock only if sufficient stock remains
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
            // Restore stock if saving the order fails
            for (const item of reservedItems) {
                await Book.updateOne(
                    { _id: item.book },
                    { $inc: { stock: item.quantity } }
                );
            }

            throw error;
        }

        // Remove purchased quantities from the user's cart
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
// Get the logged-in user's order history
exports.getMyOrders = async (req, res) => {
    try {
        const userId = req.user._id;

        const orders = await Order.find({
            user: userId
        })
            .sort({ createdAt: -1 })
            .select(
                "items shippingAddress subtotal deliveryFee totalAmount paymentMethod paymentStatus orderStatus createdAt"
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
