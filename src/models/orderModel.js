const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user",
            required: true,
            index: true
        },

        items: [
            {
                book: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Book",
                    required: true
                },

                title: {
                    type: String,
                    required: true
                },

                author: {
                    type: String,
                    required: true
                },

                image: {
                    type: String,
                    default: ""
                },

                price: {
                    type: Number,
                    required: true,
                    min: 0
                },

                quantity: {
                    type: Number,
                    required: true,
                    min: 1
                },

                subtotal: {
                    type: Number,
                    required: true,
                    min: 0
                }
            }
        ],

        shippingAddress: {
            fullName: {
                type: String,
                required: true,
                trim: true
            },

            phone: {
                type: String,
                required: true,
                trim: true
            },

            address: {
                type: String,
                required: true,
                trim: true
            },

            city: {
                type: String,
                required: true,
                trim: true
            },

            pincode: {
                type: String,
                required: true,
                trim: true
            }
        },

        subtotal: {
            type: Number,
            required: true,
            min: 0
        },

        deliveryFee: {
            type: Number,
            required: true,
            default: 0,
            min: 0
        },

        totalAmount: {
            type: Number,
            required: true,
            min: 0
        },

    coupon: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "coupon",
    default: null
    },

    couponCode: {
    type: String,
    default: null,
    trim: true,
    uppercase: true
    },

    couponDiscount: {
    type: Number,
    default: 0,
    min: 0
    },


        paymentMethod: {
            type: String,
            enum: ["COD", "RAZORPAY"],
            required: true
        },

        paymentStatus: {
            type: String,
            enum: [
                "PENDING",
                "PAID",
                "FAILED",
                "REFUNDED"
            ],
            default: "PENDING"
        },

        orderStatus: {
            type: String,
            enum: [
                "PENDING",
                "CONFIRMED",
                "SHIPPED",
                "DELIVERED",
                "CANCELLED"
            ],
            default: "PENDING"
        },

        razorpayOrderId: {
            type: String,
            default: null
        },

        razorpayPaymentId: {
            type: String,
            default: null
        },
        
        cancelledAt: {
            type: Date,
            default: null
        },

        cancellationReason: {
            type: String,
            default: null,
            trim: true
        },

        stockRestored: {
            type: Boolean,
            default: false
        },

        refundId: {
            type: String,
            default: null
        },
        paymentExpiresAt: {
        type: Date,
        default: null
},
couponUsageReleased: {
    type: Boolean,
    default: false
},
    cancellationStatus: {
    type: String,
    enum: ["NONE", "PROCESSING", "COMPLETED", "FAILED"],
    default: "NONE"
},

refundStatus: {
    type: String,
    enum: ["NOT_REQUIRED", "PROCESSING", "PROCESSED", "FAILED"],
    default: "NOT_REQUIRED"
},

    },
    
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Order", orderSchema);
