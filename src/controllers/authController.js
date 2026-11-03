
const userModel = require("../models/userModel");

// Create or find Google user
const createGoogleUser = async (profile) => {
    const googleId = profile.id;

    const email = profile.emails?.[0]?.value
        ?.trim()
        .toLowerCase();

    const userName = profile.displayName?.trim();

    if (!email) {
        throw new Error("Google account email not available");
    }

    // 1. Find an existing account linked to this Google ID
    let user = await userModel.findOne({ googleId });

    // 2. If not found, find an existing account by email
    if (!user) {
        user = await userModel.findOne({ userEmail: email });

        // Compatibility with existing documents that use userGmail
        if (!user) {
            user = await userModel.findOne({ userGmail: email });
        }

        if (user) {
            // Migrate the old email field when necessary
            if (!user.userEmail) {
                user.userEmail = user.userGmail;
            }

            user.googleId = googleId;
        }
    }

    // 3. Create a new Google user if no account exists
    if (!user) {
        user = new userModel({
            userName: userName || email.split("@")[0],
            userEmail: email,
            googleId,
            isVerified: true
        });
    }

    if (user.role === "admin") {
        throw new Error("Admin accounts cannot use Google login");
    }

    if (user.isBlocked) {
        throw new Error("This account has been blocked");
    }

    // Ensure the required email field is present before saving
    if (!user.userEmail) {
        throw new Error(
            "Google login could not find a valid userEmail for this account"
        );
    }

    user.isVerified = true;

    await user.save();

    console.log("Google user saved:", user._id);

    return user;
};

module.exports = {
    createGoogleUser,
}