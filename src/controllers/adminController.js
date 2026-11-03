const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/userModel");

// matches normal users, including old ones that have no role field yet
const NOT_ADMIN = { role: { $ne: "admin" } };

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");


// ADMIN LOGIN

const getLogin = (req, res) => {
    res.render("admin/login", { msg: null });
};

const postLogin = async (req, res) => {
    try {
        const identifier = String(
            req.body.userEmail || req.body.username || ""
        ).trim();

        const password = String(
            req.body.userPassword || req.body.password || ""
        );


        if (!identifier || !password) {
            return res.status(401).json({
                success: false,
                message: "Invalid username or password"
            });
        }

        const admin = await User.findOne({
            role: "admin",
            $or: [
                { userEmail: identifier.toLowerCase() },
                { userName: identifier }
            ]
        });

        if (!admin || !admin.userPassword) {
            return res.status(401).json({
                success: false,
                message: "Invalid username or password"
            });
        }

        const passwordMatch = await bcrypt.compare(
            password,
            admin.userPassword
        );

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid username or password"
            });
        }

         if (admin.isBlocked) {
            return res.status(403).json({
                success: false,
                message: "Your account has been blocked."
            });
        }

        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET is missing from .env");
        }

        const token = jwt.sign(
            { sub: admin._id.toString(), role: "admin" },
            process.env.JWT_SECRET,
            { expiresIn: "8h" }
        );

        res.cookie("chapterone_admin_token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 1000 * 60 * 60 * 8,
            path: "/"
        });

        return res.status(200).json({
            success: true,
            redirect: "/admin/dashboard"
        });

    } catch (error) {
        console.error("Admin login error:", error);

        return res.status(500).json({
            success: false,
            message: "Admin login error"
        });
    }
};


// DASHBOARD HOME

const getDashboard = async (req, res) => {
    try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const [totalUsers, blockedUsers, newToday, recentUsers] = await Promise.all([
            User.countDocuments(NOT_ADMIN),
            User.countDocuments({ ...NOT_ADMIN, isBlocked: true }),
            User.countDocuments({ ...NOT_ADMIN, createdAt: { $gte: startOfDay } }),
            User.find(NOT_ADMIN)
                .select("userName userEmail isBlocked createdAt")
                .sort({ _id: -1 })
                .limit(5)
        ]);

        res.render("admin/dashboard", {
            stats: { totalUsers, blockedUsers, newToday },
            recentUsers
        });
    } catch (error) {
        console.log("Dashboard error:", error);
        res.status(500).send("Error loading dashboard");
    }
};


// USER MANAGEMENT

const getUsersPage = (req, res) => {
    res.render("admin/users");
};

const getUsersData = async (req, res) => {
    try {
        const q = String(req.query.q || "").trim();
        const status = String(req.query.status || "all");
        const verified = String(req.query.verified || "all");
        const limit = 10;

        const filter = { ...NOT_ADMIN };

        if (status === "blocked") filter.isBlocked = true;
        if (status === "active")  filter.isBlocked = { $ne: true };

        if (verified === "verified")   filter.isVerified = true;
        if (verified === "unverified") filter.isVerified = { $ne: true };

        if (q) {
            const safe = escapeRegex(q);
            filter.$or = [
                { userName:  { $regex: safe, $options: "i" } },
                { userEmail: { $regex: safe, $options: "i" } }
            ];
        }

        const total = await User.countDocuments(filter);
        const totalPages = Math.max(Math.ceil(total / limit), 1);
        const page = Math.min(Math.max(parseInt(req.query.page) || 1, 1), totalPages);

        const users = await User.find(filter)
            .select("userName userEmail isVerified isBlocked createdAt")
            .sort({ _id: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.json({ success: true, users, page, totalPages, total });
    } catch (error) {
        console.log("Users data error:", error);
        res.status(500).json({ success: false, message: "Could not load users" });
    }
};

const toggleBlock = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const user = await User.findOne({ _id: req.params.id, ...NOT_ADMIN });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        user.isBlocked = !user.isBlocked;
        await user.save();

        res.json({ success: true, isBlocked: user.isBlocked });
    } catch (error) {
        console.log("Toggle block error:", error);
        res.status(500).json({ success: false, message: "Could not update user" });
    }
};


// PRODUCT MANAGEMENT (placeholder)

const getProducts = (req, res) => {
    res.render("admin/products");
};


// LOGOUT

const postLogout = (req, res) => {
    res.clearCookie("chapterone_admin_token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/"
    });

    res.set("Cache-Control", "no-store");
    return res.redirect("/admin/login");
};
module.exports = {
    getLogin,
    postLogin,
    getDashboard,
    getUsersPage,
    getUsersData,
    toggleBlock,
    getProducts,
    postLogout
};