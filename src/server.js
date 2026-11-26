
require("dotenv").config(); // Must be first

const expirePendingRazorpayOrders = require("./services/expirePendingRazorpayOrders");
const app = require("./app");
const connectDB = require("./config/db");

const PORT = process.env.PORT || process.env.port || 2211;

connectDB()
    .then(() => {
        console.log("MongoDB connected successfully");

        // Start the expired Razorpay order cleanup service
        expirePendingRazorpayOrders();

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    })
    .catch((error) => {
        console.error("Server startup failed:", error);
        process.exit(1);
    });
