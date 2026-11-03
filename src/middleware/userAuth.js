const jwt = require("jsonwebtoken")
const User = require("../models/userModel");

const COOKIE_NAME= "chapterone_token"

// Verify JWT and check the user's account//
const verifyToken = async (req,res,next)=>{
    try{
        const token = req.cookies?.[COOKIE_NAME];
        if(!token){
            return res.redirect("/user/login");
        }
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );
const user = await User.findById(decoded.sub)
    .select("_id userName userEmail role isBlocked cart");
        if(!user||user.isBlocked){
            res.clearCookie(COOKIE_NAME,{
                httpOnly : true,
                secure : process.env.NODE_ENV === "production",
                sameSite : "lax",
                path : "/"
            });

            return res.redirect("/user/login")
        }
        req.user = user;
        next();
    }catch(error){
         res.clearCookie(COOKIE_NAME,{
                httpOnly : true,
                secure: process.env.NODE_ENV === "production",
                sameSite : "lax",
                path : "/"
            });
            return res.redirect("/user/login")
    }
};


// Only normal users can access user pages//
const userAuth = async (req, res, next) => {
    try {
        await verifyToken(req, res, () => {
            if (req.user.role !== "user") {
                return res.status(403).send("Access denied");
            }

            next();
        });
    } catch (error) {
        next(error);
    }
};

// Only admins can access admin pages//
const adminAuth = async (req, res, next) => {
    try {
        await verifyToken(req, res, () => {
            if (req.user.role !== "admin") {
                return res.status(403).send("Access denied");
            }

            next();
        });
    } catch (error) {
        next(error);
    }
};
// Prevent authenticated users from opening login/signup pages
const noUser = async (req, res, next) => {
    const token = req.cookies?.[COOKIE_NAME];

    // No token: continue to login/signup route
    if (!token) {
        return next();
    }

    try {
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

       
const user = await User.findById(decoded.sub)
    .select("_id userName userEmail role isBlocked cart");  


        if (!user || user.isBlocked) {
            res.clearCookie(COOKIE_NAME, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                path: "/"
            });

            return next();
        }

        // Redirect according to the user's actual role
        return res.redirect(
            user.role === "admin"
                ? "/admin"
                : "/user/home"
        );

    } catch (error) {
        res.clearCookie(COOKIE_NAME, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/"
        });

        return next();
    }
};


const googleAuth = noUser;
module.exports = {
    verifyToken,
    userAuth,
    adminAuth,
    noUser,
    googleAuth
};