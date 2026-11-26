const express = require("express");
const router = express.Router();

const adminController = require("../controllers/adminController");
const bookController = require("../controllers/bookController");
const adminOrderController = require("../controllers/adminOrderController");
const adminAnalyticsController = require("../controllers/adminAnalyticsController")
const couponController = require("../controllers/couponController");

const noCache = require("../middleware/noCache");

const {
    adminAuth,
    noAdmin
} = require("../middleware/adminAuth");

const uploadBookImage = require("../middleware/uploadBook");
// ADMIN LOGIN
router.get("/login",noCache,noAdmin,adminController.getLogin);

router.post("/login",noCache,noAdmin,adminController.postLogin);

// DASHBOARD
router.get("/dashboard", noCache, adminAuth, adminController.getDashboard);
// USER MANAGEMENT
router.get("/users", adminAuth, adminController.getUsersPage);
router.get("/users/data", adminAuth, adminController.getUsersData);
router.patch("/users/:id/block", adminAuth, adminController.toggleBlock);

// PRODUCT MANAGEMENT
router.get("/products", adminAuth, adminController.getProducts);
router.get("/products/api", adminAuth, bookController.getBooks);
router.get("/products/add", adminAuth, bookController.getAddProduct);
router.post("/products", adminAuth, uploadBookImage, bookController.addProduct);
router.get("/products/:id", adminAuth, bookController.getBook);
router.put("/products/:id", adminAuth, uploadBookImage, bookController.updateBook);
router.delete("/products/:id", adminAuth, bookController.deleteBook);

// ORDER MANAGEMENT
router.get("/orders", adminAuth, (req, res) => {
    res.render("admin/orders");
});

router.get("/orders/api", adminAuth, adminOrderController.getAllOrders);
router.get("/orders/api/:orderId", adminAuth, adminOrderController.getOrderDetails);
router.patch("/orders/api/:orderId/status", adminAuth, adminOrderController.updateOrderStatus);

// analytics dashboard
router.get("/overview",adminAuth,    
    (req, res) => {
        res.render("admin/overview");
    }
);
router.get("/api/analytics",adminAuth,adminAnalyticsController.getAnalytics);
router.post("/logout", noCache, adminController.postLogout);

// COUPON MANAGEMENT

router.get( "/coupons",adminAuth,couponController.getCouponsPage);
router.get("/coupons/api",adminAuth,couponController.getCoupons);
router.post("/coupons/api",adminAuth,couponController.createCoupon);
router.put("/coupons/api/:id",adminAuth,couponController.updateCoupon);
router.patch("/coupons/api/:id/status",adminAuth,couponController.toggleCouponStatus);
router.delete("/coupons/api/:id",adminAuth,couponController.deleteCoupon);

module.exports = router;