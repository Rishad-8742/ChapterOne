const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const passport = require("passport");

const userRoutes = require("./routes/userRoutes");
const googleRoutes = require("./routes/googleRoutes");
const adminRoutes = require("./routes/adminRoutes");

require("./config/passport");

const app = express();
// Middleware
app.use(cookieParser());

app.use(express.json({ limit: "20mb" }));

app.use(express.urlencoded({
    extended: true,
    limit: "20mb"
}));

app.use(passport.initialize());

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));
app.use(express.static(path.join(__dirname, "..", "public")));

app.use("/user", userRoutes);
app.use("/auth", googleRoutes);
app.use("/admin", adminRoutes);


app.use((req, res) => {
    res.status(404).send("404 page not found");
});

module.exports = app;