
"use strict";

const mongoose = require("mongoose");

// Schema for each saved shipping address
const addressSchema = new mongoose.Schema({
    label: {
        type: String,
        enum: ["Home", "Work", "Other"],
        default: "Home"
    },

    fullName: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 60
    },

    phone: {
        type: String,
        required: true,
        match: /^[6-9]\d{9}$/
    },

    address: {
        type: String,
        required: true,
        trim: true,
        minlength: 10,
        maxlength: 250
    },

    city: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 60
    },

    pincode: {
        type: String,
        required: true,
        match: /^\d{6}$/
    },

    isDefault: {
        type: Boolean,
        default: false
    }
});

// Main user schema
const userSchema = new mongoose.Schema({
    userName: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 40
    },

   userEmail: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
},

    userPassword: {
        type: String,
        required: false
    },

    googleId: {
        type: String,
        unique: true,
        sparse: true
    },

    // Optional contact number for the user's profile
    phone: {
        type: String,
        default: ""
    },

    // Multiple saved delivery addresses
    addresses: {
        type: [addressSchema],
        default: []
    },
    
cart: [
    {
        bookId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Book",
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1,
            default: 1
        }
    }
],


    role: {
        type: String,
        enum: ["user", "admin"],
        default: "user"
    },

    isBlocked: {
        type: Boolean,
        default: false
    },

    isVerified: {
        type: Boolean,
        default: true
    }
});

module.exports = mongoose.model("user", userSchema);

     