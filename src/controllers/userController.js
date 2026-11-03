
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const Book = require("../models/bookModel");


// SIGNUP PAGE

const getSignup = (req, res) => {
    res.set("Cache-Control","no-store");
    res.render("user/signup",{msg:null});
};


// SIGNUP

const postSignup = async (req, res) => {
    try {
        const userEmail = req.body.userEmail.trim().toLowerCase();

        const existingUser = await User.findOne({ userEmail });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "This Gmail is already registered"
            });
        }

        const hashedPassword = await bcrypt.hash(
            req.body.userPassword,
            10
        );


        const newUser = new User({
            userName: req.body.userName,
            userEmail: userEmail,
            userPassword: hashedPassword,
            isVerified: true
        });

        await newUser.save();

        console.log("User saved to MongoDB", newUser);

        return res.status(201).json({
            success: true,
            message: "Account created successfully",
            redirect: "/user/login"
        });

    } catch (error) {
        console.log("Signup error:", error);

        return res.status(500).json({
            success: false,
            message: "Error saving user"
        });
    }
};

// LOGIN

const getLogin = (req, res) => {
    res.set("Cache-Control","no-store");
    res.render("user/login",{msg : null});

};


const postLogin = async (req, res) => {
    try {
        const userEmail = req.body.userEmail?.trim().toLowerCase();
        const password = req.body.userPassword;

         if (!userEmail||!password) {
            return res.status(401).json({
                success: false,
                message: "Email and password are required."
            });
        }


        const user = await User.findOne({ userEmail });

        if (!user || !user.userPassword ) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const passwordMatch = await bcrypt.compare(
            password,
            user.userPassword
        );

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        if (user.isBlocked) {
            return res.status(403).json({
                success: false,
                message: "Your account has been blocked."
            });
        }

        if(user.role !== "user"){
            return res.status(403).json({
                success:false,
                message: "Please use the admin login"
            });
        }

        if(!process.env.JWT_SECRET){
            throw new Error("JWT_SECRET is missing from .env");
        }

        const token = jwt.sign(
            {sub: user._id.toString() },
            process.env.JWT_SECRET,
            { expiresIn: "8h" }
        );

          res.cookie("chapterone_token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 1000 * 60 * 60 * 8,
            path: "/"
        });

        return res.status(200).json({
            success:true,
            message:"login successful",
            redirect:"/user/home"
        })

    } catch (error) {
        console.error("Login error:", error);

        return res.status(500).json({
            success: false,
            message: "Something went wrong. Please try again."
        });
    }
};

const getHome = async (req, res) => {
    res.set("Cache-Control","no-store")
    res.render("user/home",{msg:null})
}

const getLogout = (req, res) => {
    res.clearCookie("chapterone_token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/"
    });

    res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");

    return res.redirect("/user/login");
};
const getBooks = async (req, res) => {
    try {
        const books = await Book.find()
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            books
        });

    } catch (error) {
        console.error("Get books error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch books"
        });
    }
};


const getCategories = async (req, res) => {

    try {

        const categories = await Book.aggregate([

            {
                $group: {
                    _id: "$genre",
                    count: {
                        $sum: 1
                    }
                }
            },

            {
                $project: {
                    _id: 0,
                    name: "$_id",
                    count: 1
                }
            },

            {
                $sort: {
                    name: 1
                }
            }

        ]);

        return res.status(200).json({
            success: true,
            categories
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch categories"
        });

    }
};


const getFeaturedBooks = async (req, res) => {

    try {

        const books = await Book.find({
            isFeatured: true
        })
        .sort({
            createdAt: -1
        })
        .limit(4)
        .select(
            "title author price image"
        );


        return res.status(200).json({

            success: true,

            books

        });


    } catch (error) {

        console.error(
            "Featured books error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Unable to load featured books"

        });

    }

};

const getBooksPage = (req, res) => {

    res.render("user/book");

};



// ================= ACCOUNT MANAGEMENT =================

// RENDER ACCOUNT PAGE
const getAccount = (req,res) =>{
    res.render("user/account");
}

// GET PROFILE DATA
const getAccountData = async (req, res) => {
    try {
        

        const user = await User.findById(req.user._id)
            .select("userName userEmail userGmail phone addresses");

        console.log("Database user ID:", user?._id);
        console.log("Database user name:", user?.userName);
        console.log("Saved addresses:", user?.addresses);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        return res.status(200).json({
            success: true,
            profile: user
        });

    } catch (error) {
        console.error("Get account error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to load account details"
        });
    }
};

// UPDATE PROFILE
const updateAccount = async (req, res) => {
    try {
        const { userName, userEmail, phone } = req.body;

        if (
            typeof userName !== "string" ||
            userName.trim().length < 2 ||
            userName.trim().length > 40
        ) {
            return res.status(400).json({
                success: false,
                message: "Name must contain 2–40 characters."
            });
        }

        if (
            typeof userEmail !== "string" ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail.trim())
        ) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid email address."
            });
        }

        if (
            phone !== undefined &&
            phone !== "" &&
            (typeof phone !== "string" || !/^[6-9]\d{9}$/.test(phone))
        ) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid 10-digit Indian phone number."
            });
        }

        const normalizedEmail = userEmail.trim().toLowerCase();

        const existingUser = await User.findOne({
            userEmail: normalizedEmail,
            _id: { $ne: req.user._id }
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "This email is already registered."
            });
        }

        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        user.userName = userName.trim();
        user.userEmail = normalizedEmail;
        user.phone = phone || "";

        await user.save();

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully.",
            profile: {
                userName: user.userName,
            userEmail: user.userEmail,
                phone: user.phone
            }
        });

    } catch (error) {
        console.error("Update account error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to update profile."
        });
    }
};


// ADD SHIPPING ADDRESS
const addAddress = async (req, res) => {
    try {
        const {
            label,
            fullName,
            phone,
            address,
            city,
            pincode,
            isDefault
        } = req.body;

        if (
            !["Home", "Work", "Other"].includes(label) ||
            typeof fullName !== "string" ||
            fullName.trim().length < 2 ||
            fullName.trim().length > 60 ||
            typeof phone !== "string" ||
            !/^[6-9]\d{9}$/.test(phone) ||
            typeof address !== "string" ||
            address.trim().length < 10 ||
            address.trim().length > 250 ||
            typeof city !== "string" ||
            city.trim().length < 2 ||
            city.trim().length > 60 ||
            typeof pincode !== "string" ||
            !/^\d{6}$/.test(pincode)
        ) {
            return res.status(400).json({
                success: false,
                message: "Please enter valid shipping address details."
            });
        }

        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        const makeDefault = isDefault === true || isDefault === "true";

        if (makeDefault) {
            user.addresses.forEach(item => {
                item.isDefault = false;
            });
        }

        user.addresses.push({
            label,
            fullName: fullName.trim(),
            phone,
            address: address.trim(),
            city: city.trim(),
            pincode,
            isDefault: makeDefault || user.addresses.length === 0
        });

        await user.save();

        return res.status(201).json({
            success: true,
            message: "Address saved successfully.",
            addresses: user.addresses
        });

    } catch (error) {
        console.error("Add address error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to save address."
        });
    }
};


// UPDATE SHIPPING ADDRESS
const updateAddress = async (req, res) => {
    try {
        const {
            label,
            fullName,
            phone,
            address,
            city,
            pincode,
            isDefault
        } = req.body;

        if (
            !["Home", "Work", "Other"].includes(label) ||
            typeof fullName !== "string" ||
            fullName.trim().length < 2 ||
            fullName.trim().length > 60 ||
            typeof phone !== "string" ||
            !/^[6-9]\d{9}$/.test(phone) ||
            typeof address !== "string" ||
            address.trim().length < 10 ||
            address.trim().length > 250 ||
            typeof city !== "string" ||
            city.trim().length < 2 ||
            city.trim().length > 60 ||
            typeof pincode !== "string" ||
            !/^\d{6}$/.test(pincode)
        ) {
            return res.status(400).json({
                success: false,
                message: "Please enter valid shipping address details."
            });
        }

        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        const savedAddress = user.addresses.id(req.params.addressId);

        if (!savedAddress) {
            return res.status(404).json({
                success: false,
                message: "Address not found."
            });
        }

        const makeDefault = isDefault === true || isDefault === "true";

        if (makeDefault) {
            user.addresses.forEach(item => {
                item.isDefault = false;
            });
        }

        savedAddress.label = label;
        savedAddress.fullName = fullName.trim();
        savedAddress.phone = phone;
        savedAddress.address = address.trim();
        savedAddress.city = city.trim();
        savedAddress.pincode = pincode;

        if (makeDefault) {
            savedAddress.isDefault = true;
        }

        await user.save();

        return res.status(200).json({
            success: true,
            message: "Address updated successfully.",
            addresses: user.addresses
        });

    } catch (error) {
        console.error("Update address error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to update address."
        });
    }
};


// DELETE SHIPPING ADDRESS
const deleteAddress = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        const address = user.addresses.id(req.params.addressId);

        if (!address) {
            return res.status(404).json({
                success: false,
                message: "Address not found."
            });
        }

        const wasDefault = address.isDefault;

        address.deleteOne();

        if (wasDefault && user.addresses.length > 0) {
            user.addresses[0].isDefault = true;
        }

        await user.save();

        return res.status(200).json({
            success: true,
            message: "Address deleted successfully.",
            addresses: user.addresses
        });

    } catch (error) {
        console.error("Delete address error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to delete address."
        });
    }
};


// SET DEFAULT SHIPPING ADDRESS
const setDefaultAddress = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        const address = user.addresses.id(req.params.addressId);

        if (!address) {
            return res.status(404).json({
                success: false,
                message: "Address not found."
            });
        }

        user.addresses.forEach(item => {
            item.isDefault = item._id.equals(address._id);
        });

        await user.save();

        return res.status(200).json({
            success: true,
            message: "Default address updated.",
            addresses: user.addresses
        });

    } catch (error) {
        console.error("Set default address error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to set default address."
        });
    }
};


// RENDER ADDRESS PAGE
const getAddressPage = (req, res) => {
    res.render("user/address");
};

// RENDER ORDERS PAGE
const getOrdersPage = (req, res) => {
    res.render("user/orders");
};

module.exports = {
    getSignup,
    postSignup,
    getLogin,
    postLogin,
    getHome,
    getBooks,
    getFeaturedBooks,
    getBooksPage,
    getAccount,
    getAccountData,
    updateAccount,
    addAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
    getAddressPage,
    getOrdersPage,
    getLogout
};
