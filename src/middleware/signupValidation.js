const {body,validationResult} = require("express-validator")

const signupValidation = [
    body("userName")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .bail()
    .isLength({ min:2 , max: 40})
    .withMessage("Name must be between 2 and 40 characters"),

    body("userEmail")
    .trim()
    .notEmpty()
    .withMessage("Gmail is required")
    .bail()
    .isEmail()
    .withMessage("Enter a valid email address")
    .normalizeEmail(),

    body("userPassword")
    .notEmpty()
    .withMessage("password is required")
    .bail()
    .isLength({min:8})
    .withMessage("Password must contain at least 8 characters"),

    body("confirmPassword")
    .notEmpty()
    .withMessage("please confirm your password")
    .bail()
    .custom((value,{req})=>{
        return value == req.body.userPassword;
    })
    .withMessage("Passwords do not match")
];


const checkValidation = (req, res, next) => {
    const errors = validationResult(req);

   if (!errors.isEmpty()) {
    return res.render("user/signup", {
        errors: errors.array(),
        formData: req.body,
        googleError: null
    });
}
    next();
};
module.exports = {
    signupValidation,
    checkValidation
};