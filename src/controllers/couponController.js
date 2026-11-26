
"use strict";

const Coupon = require("../models/couponModel");

// GET COUPON MANAGEMENT PAGE
const getCouponsPage = (req, res) => {
    res.render("admin/coupons");
};

// GET ALL COUPONS
const getCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find().sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            coupons
        });
    } catch (error) {
        console.error("Get coupons error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch coupons"
        });
    }
};


// GET AVAILABLE COUPONS FOR CHECKOUT
const getAvailableCoupons = async (req, res) => {
    try {
        const now = new Date();

        const coupons = await Coupon.find({
            isActive: true,
            startDate: { $lte: now },
            expiryDate: { $gt: now },
            $expr: {
                $lt: ["$usedCount", "$usageLimit"]
            }
        })
        .select(
            "code discountType discountValue maxDiscount minPurchase expiryDate"
        )
        .sort({ expiryDate: 1 })
        .lean();

        return res.status(200).json({
            success: true,
            coupons
        });

    } catch (error) {
        console.error("Available coupons error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to load available coupons."
        });
    }
};

// VALIDATE COUPON INPUT
const validateCouponInput = (body) => {
    const code = String(body.code || "").trim().toUpperCase();
    const discountType = body.discountType;
    const discountValue = Number(body.discountValue);
    const minPurchase = Number(body.minPurchase || 0);
    const usageLimit = Number(body.usageLimit);
    const maxDiscount =
        body.maxDiscount === "" ||
        body.maxDiscount === undefined ||
        body.maxDiscount === null
            ? null
            : Number(body.maxDiscount);

    const startDate = body.startDate
        ? new Date(body.startDate)
        : new Date();

    const expiryDate = new Date(body.expiryDate);

    if (!/^[A-Z0-9_-]{3,30}$/.test(code)) {
        return { error: "Enter a valid coupon code (3-30 characters)" };
    }

    if (!["fixed", "percentage"].includes(discountType)) {
        return { error: "Invalid discount type" };
    }

    if (!Number.isFinite(discountValue) || discountValue <= 0) {
        return { error: "Discount value must be greater than zero" };
    }

    if (discountType === "percentage" && discountValue > 100) {
        return { error: "Percentage discount cannot exceed 100%" };
    }

    if (
        discountType === "fixed" &&
        maxDiscount !== null
    ) {
        return { error: "Maximum discount is only for percentage coupons" };
    }

    if (
        discountType === "percentage" &&
        maxDiscount !== null &&
        (!Number.isFinite(maxDiscount) || maxDiscount <= 0)
    ) {
        return { error: "Maximum discount must be greater than zero" };
    }

    if (!Number.isFinite(minPurchase) || minPurchase < 0) {
        return { error: "Minimum purchase cannot be negative" };
    }

    if (!Number.isInteger(usageLimit) || usageLimit < 1) {
        return { error: "Usage limit must be at least 1" };
    }

    if (Number.isNaN(startDate.getTime())) {
        return { error: "Invalid start date" };
    }

    if (Number.isNaN(expiryDate.getTime())) {
        return { error: "Please select a valid expiry date" };
    }

    if (expiryDate <= startDate) {
        return { error: "Expiry date must be after start date" };
    }

    return {
        data: {
            code,
            discountType,
            discountValue,
            maxDiscount,
            minPurchase,
            usageLimit,
            startDate,
            expiryDate
        }
    };
};

// CREATE COUPON
const createCoupon = async (req, res) => {
    try {
        const validation = validateCouponInput(req.body);

        if (validation.error) {
            return res.status(400).json({
                success: false,
                message: validation.error
            });
        }

        const existingCoupon = await Coupon.findOne({
            code: validation.data.code
        });

        if (existingCoupon) {
            return res.status(409).json({
                success: false,
                message: "This coupon code already exists"
            });
        }

        const coupon = await Coupon.create(validation.data);

        return res.status(201).json({
            success: true,
            message: "Coupon created successfully",
            coupon
        });
    } catch (error) {
        console.error("Create coupon error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create coupon"
        });
    }
};

// UPDATE COUPON
const updateCoupon = async (req, res) => {
    try {
        const validation = validateCouponInput(req.body);

        if (validation.error) {
            return res.status(400).json({
                success: false,
                message: validation.error
            });
        }

        const coupon = await Coupon.findById(req.params.id);

        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: "Coupon not found"
            });
        }

        const duplicateCode = await Coupon.findOne({
            code: validation.data.code,
            _id: { $ne: coupon._id }
        });

        if (duplicateCode) {
            return res.status(409).json({
                success: false,
                message: "This coupon code already exists"
            });
        }

        if (validation.data.usageLimit < coupon.usedCount) {
            return res.status(400).json({
                success: false,
                message: "Usage limit cannot be less than the number of times used"
            });
        }

        Object.assign(coupon, validation.data);

        await coupon.save();

        return res.status(200).json({
            success: true,
            message: "Coupon updated successfully",
            coupon
        });
    } catch (error) {
        console.error("Update coupon error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update coupon"
        });
    }
};

// TOGGLE COUPON STATUS
const toggleCouponStatus = async (req, res) => {
    try {
        const coupon = await Coupon.findById(req.params.id);

        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: "Coupon not found"
            });
        }

        coupon.isActive = !coupon.isActive;
        await coupon.save();

        return res.status(200).json({
            success: true,
            message: "Coupon status updated",
            coupon
        });
    } catch (error) {
        console.error("Toggle coupon error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update coupon status"
        });
    }
};

// DELETE COUPON
const deleteCoupon = async (req, res) => {
    try {
        const coupon = await Coupon.findById(req.params.id);

        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: "Coupon not found"
            });
        }

        if (coupon.usedCount > 0) {
            return res.status(400).json({
                success: false,
                message: "A coupon that has been used cannot be deleted"
            });
        }

        await Coupon.findByIdAndDelete(req.params.id);

        return res.status(200).json({
            success: true,
            message: "Coupon deleted successfully"
        });
    } catch (error) {
        console.error("Delete coupon error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete coupon"
        });
    }
};

module.exports = {
    getCouponsPage,
    getCoupons,
    getAvailableCoupons,
    createCoupon,
    updateCoupon,
    toggleCouponStatus,
    deleteCoupon
};
