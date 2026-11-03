const passport = require("passport")
const GoogleStrategy = require("passport-google-oauth20").Strategy;

const userModel = require("../models/userModel")
const {
    createGoogleUser
}= require("../controllers/authController");

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL
        },
       async (accessToken, refreshToken, profile, done) => {
    try {
        const user = await createGoogleUser(profile);

        return done(null, user);

    } catch (error) {

        if (error.message.includes("already exists")) {
            return done(null, false, {
                message: error.message
            });
        }

        return done(error, null);
    }
}
    )
);

// Store user ID in session
passport.serializeUser((user, done) => {
    done(null, user._id);
});

// Retrieve user from MongoDB
passport.deserializeUser(async (id, done) => {
    try {
        const user = await userModel.findById(id);

        done(null, user);
    } catch (error) {
        done(error, null);
    }
});
