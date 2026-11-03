const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const COOKIE_NAME = "chapterone_admin_token";

const adminAuth = async (req, res, next) => {
    try {
        const token = req.cookies?.[COOKIE_NAME];

        if (!token || !process.env.JWT_SECRET) {
            return handleUnauthorized(req, res);
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const admin = await User.findById(decoded.sub)
            .select("_id userName userEmail role isBlocked");

        if (!admin || admin.role !== "admin" || admin.isBlocked) {
            res.clearCookie(COOKIE_NAME, { path: "/" });
            return handleUnauthorized(req, res);
        }

        req.admin = admin;
        return next();

    } catch (error) {
        res.clearCookie(COOKIE_NAME, { path: "/" });
        return handleUnauthorized(req, res);
    }
};

const handleUnauthorized = (req, res) => {
    if (req.get("X-Requested-With") === "fetch") {
        return res.status(401).json({
            success: false,
            message: "Admin authentication expired. Please log in again."
        });
    }

    return res.redirect("/admin/login");
};

const noAdmin = async (req, res, next) => {
    try {
        const token = req.cookies?.[COOKIE_NAME];

        if (!token || !process.env.JWT_SECRET) {
            return next();
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const admin = await User.findById(decoded.sub)
            .select("_id role isBlocked");

        if (admin && admin.role === "admin" && !admin.isBlocked) {
            return res.redirect("/admin/dashboard");
        }

        res.clearCookie(COOKIE_NAME, { path: "/" });
        return next();

    } catch (error) {
        res.clearCookie(COOKIE_NAME, { path: "/" });
        return next();
    }
};

module.exports = {
    adminAuth,
    noAdmin
};
