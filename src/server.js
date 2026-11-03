require("dotenv").config();   // must be first

const app = require("./app");
const connectDB = require("./config/db");

const PORT = process.env.port || 3000;

connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});