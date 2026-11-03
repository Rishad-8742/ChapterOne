const express = require("express");
const passport = require("passport");
const jwt = require("jsonwebtoken");
const router = express.Router();

const noCache = require("../middleware/noCache");
const { noUser } = require("../middleware/userAuth");

const COOKIE_NAME = "chapterone_token";

// GOOGLE SIGNUP
router.get("/google/signup", noCache, noUser, (req, res, next) => {
    passport.authenticate("google", {
        scope: ["profile", "email"],
        prompt: "select_account",
        state: "signup"
    })(req, res, next);
});

// GOOGLE LOGIN
router.get("/google/login", noCache, noUser, (req, res, next) => {
    passport.authenticate("google", {
        scope: ["profile", "email"],
        prompt: "select_account",
        state: "login"
    })(req, res, next);
});

// GOOGLE CALLBACK
router.get(
    "/google/callback",
    noCache,
    (req, res, next) => {
        passport.authenticate("google", {
            session: false,
            failureRedirect: "/user/login"
        })(req, res, next);
    },
    (req, res) => {
        try {
            if (!process.env.JWT_SECRET) {
                throw new Error("JWT_SECRET is missing from .env");
            }

            const user = req.user;

            if (!user || user.isBlocked || user.role !== "user") {
                return res.redirect("/user/login");
            }

            const token = jwt.sign(
                { sub: user._id.toString() },
                process.env.JWT_SECRET,
                { expiresIn: "8h" }
            );

            res.cookie(COOKIE_NAME, token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                maxAge: 1000 * 60 * 60 * 8,
                path: "/"
            });

            return res.redirect("/user/home");
        } catch (error) {
            console.error("Google authentication error:", error);
            return res.redirect("/user/login");
        }
    }
);

module.exports = router;
