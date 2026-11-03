const mongoose = require("mongoose");
const connectDB = async () => {
    try{
    await mongoose.connect(process.env.MONGO_URI);
    console.log("connected to DB")
    console.log("Database:", mongoose.connection.name);
    }catch(err) {
        console.log("failed to connect DB",err)
    }
};

module.exports = connectDB;