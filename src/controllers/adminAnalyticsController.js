
const Order = require("../models/orderModel");

// Exclude cancelled, failed and refunded orders.
// COD orders count as sales; Razorpay orders count only when paid.
const SALES_MATCH = {
    orderStatus: { $ne: "CANCELLED" },
    paymentStatus: { $nin: ["FAILED", "REFUNDED"] },
    $or: [
        { paymentMethod: "COD" },
        { paymentMethod: "RAZORPAY", paymentStatus: "PAID" }
    ]
};

// Only successfully paid orders count as collected revenue.
const REVENUE_MATCH = {
    paymentStatus: "PAID",
    orderStatus: { $ne: "CANCELLED" }
};

exports.getAnalytics = async (req, res) => {
    try {
        const now = new Date();
        const startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);

        const [revenueRows, genreRows, topRows, statusRows] =
            await Promise.all([
                // 1. Revenue by day: last 7 days
                Order.aggregate([
                    {
                        $match: {
                            ...REVENUE_MATCH,
                            createdAt: { $gte: startDate, $lte: now }
                        }
                    },
                    {
                        $group: {
                            _id: {
                                $dateToString: {
                                    format: "%Y-%m-%d",
                                    date: "$createdAt",
                                    timezone: "Asia/Kolkata"
                                }
                            },
                            revenue: { $sum: "$totalAmount" }
                        }
                    },
                    { $sort: { _id: 1 } }
                ]),

                // 2. Sales grouped by book genre
                Order.aggregate([
                    { $match: SALES_MATCH },
                    { $unwind: "$items" },
                    {
                        $lookup: {
                            from: "books",
                            localField: "items.book",
                            foreignField: "_id",
                            as: "bookInfo"
                        }
                    },
                    {
                        $unwind: {
                            path: "$bookInfo",
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $group: {
                            _id: {
                                $ifNull: ["$bookInfo.genre", "Unknown"]
                            },
                            quantity: { $sum: "$items.quantity" }
                        }
                    },
                    { $sort: { quantity: -1 } }
                ]),

                // 3. Top 5 books by copies sold
                Order.aggregate([
                    { $match: SALES_MATCH },
                    { $unwind: "$items" },
                    {
                        $group: {
                            _id: "$items.book",
                            title: { $first: "$items.title" },
                            quantity: { $sum: "$items.quantity" }
                        }
                    },
                    { $sort: { quantity: -1, title: 1 } },
                    { $limit: 5 },
                    {
                        $project: {
                            _id: 0,
                            title: 1,
                            quantity: 1
                        }
                    }
                ]),

                // 4. Order status distribution
                Order.aggregate([
                    {
                        $match: {
                            orderStatus: {
                                $in: [
                                    "PENDING",
                                    "CONFIRMED",
                                    "SHIPPED",
                                    "DELIVERED"
                                ]
                            }
                        }
                    },
                    {
                        $group: {
                            _id: "$orderStatus",
                            count: { $sum: 1 }
                        }
                    }
                ])
            ]);

        // Fill missing dates with zero revenue.
        const revenueMap = new Map(
            revenueRows.map(row => [row._id, row.revenue])
        );

        const revenueTimeline = [];

        for (let i = 6; i >= 0; i--) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);

            const key = date.toLocaleDateString("en-CA", {
                timeZone: "Asia/Kolkata"
            });

            revenueTimeline.push({
                date: key,
                revenue: revenueMap.get(key) || 0
            });
        }

        const statusMap = Object.fromEntries(
            statusRows.map(row => [row._id, row.count])
        );

        const orderStatuses = [
            { status: "Pending", count: statusMap.PENDING || 0 },
            { status: "Confirmed", count: statusMap.CONFIRMED || 0 },
            { status: "Shipped", count: statusMap.SHIPPED || 0 },
            { status: "Delivered", count: statusMap.DELIVERED || 0 }
        ];

        res.json({
            success: true,
            analytics: {
                revenueTimeline,
                salesByGenre: genreRows.map(row => ({
                    genre: row._id || "Unknown",
                    quantity: row.quantity
                })),
                topBooks: topRows,
                orderStatuses
            }
        });
    } catch (error) {
        console.error("Admin analytics error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to load analytics"
        });
    }
};
