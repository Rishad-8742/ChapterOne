require("dotenv").config();
const bcrypt = require("bcrypt");
const connectDB = require("../src/config/db");
const User = require("../src/models/userModel");

(async () => {
    const name = process.env.Admin_Name;
    const email = (process.env.Admin_Email || "").trim().toLowerCase();
    const password = process.env.Admin_Password;

    if (!name || !email || !password) {
        console.log("Admin_Name, Admin_Email or Admin_Password is missing in .env");
        process.exit(1);
    }

    await connectDB();

    // the email must not belong to a normal user
    const taken = await User.findOne({ userEmail: email, role: { $ne: "admin" } });
    if (taken) {
        console.log("This email is already used by a normal user account");
        process.exit(1);
    }

    const hashed = await bcrypt.hash(password, 10);

    // finds your existing admin (by name or by the old placeholder email) and updates it
    await User.findOneAndUpdate(
        {
            role: "admin",
            $or: [
                { userName: name },
                { userEmail: `${name.toLowerCase()}@admin.local` }
            ]
        },
        {
            userName: name,
            userEmail: email,
            userPassword: hashed,
            role: "admin"
        },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    console.log("Admin ready:", name, "|", email);
    process.exit(0);
})();