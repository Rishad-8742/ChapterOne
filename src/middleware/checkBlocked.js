const User = require("../models/userModel");

const checkBlocked = async (req, res, next) => {
    const sessionUser = req.user._id.user;
    if (!sessionUser) return next();

    try {
        const user = await User.findById(sessionUser.id).select("isBlocked");

        // account deleted or blocked: end the session immediately
        if (!user || user.isBlocked) {
            return req.user._id.destroy(() => {
                res.clearCookie("connect.sid", { path: "/" });

                if (req.get("X-Requested-With") === "fetch") {
                    return res.status(403).json({ success: false, message: "Your account has been blocked" });
                }
                res.redirect("/user/login");
            });
        }

        next();
    } catch (error) {
        next(error);
    }
};

module.exports = checkBlocked;