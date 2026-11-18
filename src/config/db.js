const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        const uri = new URL(process.env.MONGO_URI);

        await mongoose.connect(process.env.MONGO_URI);

        console.log("Connected to MongoDB");
        console.log("Database:", mongoose.connection.name);
        console.log("MongoDB host:", mongoose.connection.host);
        console.log("Configured host:", uri.hostname);

    } catch (err) {
        console.error("MongoDB connection failed:", err);
    }
};

module.exports = connectDB;
