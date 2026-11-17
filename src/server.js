require("dotenv").config();   // must be first

const app = require("./app");
console.log("🔥 CHAPTERONE SERVER.JS LOADED 🔥");
const connectDB = require("./config/db");

const PORT = process.env.PORT || process.env.port || 2211;

connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});