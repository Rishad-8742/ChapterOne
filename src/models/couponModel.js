
const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
    {
        code: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            uppercase: true
        },

        discountType: {
            type: String,
            enum: ["fixed", "percentage"],
            required: true
        },

        discountValue: {
            type: Number,
            required: true,
            min: 1
        },

        // Only applicable to percentage coupons
        maxDiscount: {
            type: Number,
            default: null,
            min: 0
        },

        // Minimum cart amount required
        minPurchase: {
            type: Number,
            default: 0,
            min: 0
        },

        // Maximum total number of uses
        usageLimit: {
            type: Number,
            required: true,
            min: 1
        },

        // Number of successful coupon uses
        usedCount: {
            type: Number,
            default: 0,
            min: 0
        },

        startDate: {
            type: Date,
            default: Date.now
        },

        expiryDate: {
            type: Date,
            required: true
        },

        isActive: {
            type: Boolean,
            default: true
        }
    },
    { timestamps: true }
);

// Validation
couponSchema.pre("validate", function () {
    if (
        this.discountType === "percentage" &&
        this.discountValue > 100
    ) {
        this.invalidate(
            "discountValue",
            "Percentage discount cannot exceed 100"
        );
    }

    if (
        this.discountType === "fixed" &&
        this.maxDiscount !== null
    ) {
        this.invalidate(
            "maxDiscount",
            "Maximum discount is only applicable to percentage coupons"
        );
    }

    if (
        this.startDate &&
        this.expiryDate &&
        this.expiryDate <= this.startDate
    ) {
        this.invalidate(
            "expiryDate",
            "Expiry date must be after the start date"
        );
    }

    if (this.usedCount > this.usageLimit) {
        this.invalidate(
            "usedCount",
            "Used count cannot exceed the usage limit"
        );
    }
});

const Coupon = mongoose.model("coupon", couponSchema);

module.exports = Coupon;
