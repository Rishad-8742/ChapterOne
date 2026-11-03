const express = require("express");
const router = express.Router();

const userController = require("../controllers/userController");
const bookController = require("../controllers/bookController");
const orderController = require("../controllers/orderController");

const noCache = require("../middleware/noCache");
const { noUser, userAuth } = require("../middleware/userAuth");
const { signupValidation, checkValidation } = require("../middleware/signupValidation");
const checkBlocked = require("../middleware/checkBlocked");

// AUTH
router.get("/signup", noCache, noUser, userController.getSignup);
router.post("/signup", noCache, noUser, signupValidation, checkValidation, userController.postSignup);
router.get("/login", noCache, noUser, userController.getLogin);
router.post("/login", noCache, noUser, userController.postLogin);
router.get("/logout", noCache, userAuth, userController.getLogout);

// HOME
router.get("/home", noCache, userAuth, userController.getHome);

// BOOKS
router.get("/api/books/new-arrivals", noCache, userAuth, bookController.getNewArrivals);
router.get("/api/books", userAuth, userController.getBooks);
router.get("/api/books/featured", noCache, userAuth, userController.getFeaturedBooks);
router.get("/books", noCache, userAuth, userController.getBooksPage);
router.get("/books/:id", noCache, userAuth, checkBlocked, (req, res) => res.render("user/selectedBook", { bookId: req.params.id }));
router.get("/api/books/:id", userAuth, checkBlocked, bookController.getBook);

// CART
router.get("/cart", noCache, userAuth, (req, res) => res.render("user/cart"));
router.get("/cart/data", noCache, userAuth, bookController.getCartData);
router.get("/cart/count", noCache, userAuth, bookController.getCartCount);
router.post("/cart", noCache, userAuth, bookController.addToCart);
router.patch("/cart/:bookId", noCache, userAuth, bookController.updateCartItem);
router.delete("/cart/:bookId", noCache, userAuth, bookController.removeCartItem);

// CHECKOUT
router.get("/checkout", noCache, userAuth, checkBlocked, (req, res) => res.render("user/checkout"));
router.post("/api/orders/cod", noCache, userAuth, checkBlocked, orderController.createCodOrder);
router.post("/api/orders/razorpay",noCache,userAuth,checkBlocked,orderController.createRazorpayOrder);
router.post("/api/orders/razorpay/verify",noCache,userAuth,checkBlocked,orderController.verifyRazorpayPayment);


// ORDERS
router.get("/orders", noCache, userAuth, checkBlocked, userController.getOrdersPage);
router.get("/api/orders", noCache, userAuth, checkBlocked, orderController.getMyOrders);

// ACCOUNT
router.get("/account", noCache, userAuth, checkBlocked, userController.getAccount);
router.get("/api/account", noCache, userAuth, checkBlocked, userController.getAccountData);
router.patch("/api/account", noCache, userAuth, checkBlocked, userController.updateAccount);

// ADDRESSES
router.get("/address", noCache, userAuth, checkBlocked, userController.getAddressPage);
router.post("/api/account/addresses", noCache, userAuth, checkBlocked, userController.addAddress);
router.patch("/api/account/addresses/:addressId", noCache, userAuth, checkBlocked, userController.updateAddress);
router.delete("/api/account/addresses/:addressId", noCache, userAuth, checkBlocked, userController.deleteAddress);
router.patch("/api/account/addresses/:addressId/default", noCache, userAuth, checkBlocked, userController.setDefaultAddress);

module.exports = router;