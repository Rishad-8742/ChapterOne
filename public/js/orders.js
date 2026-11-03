
"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const ordersList = document.getElementById("ordersList");

    if (!ordersList) return;

async function loadOrders() {
    try {
        const response = await fetch("/user/api/orders", {
            method: "GET",
            credentials: "include",
            headers: {
                Accept: "application/json"
            },
            cache: "no-store"
        });

        const data = await response.json();

        console.log("Orders API response:", data);

        if (!response.ok || data.success !== true) {
            throw new Error(data.message || "Unable to load orders.");
        }

        if (!Array.isArray(data.orders)) {
            throw new Error("Invalid orders response from server.");
        }

        renderOrders(data.orders);

    } catch (error) {
        console.error("Orders error:", error);

        ordersList.replaceChildren(
            createElement(
                "p",
                "empty-state",
                error.message || "Unable to load orders."
            )
        );
    }
}


    function createElement(tag, className, text) {
        const element = document.createElement(tag);

        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;

        return element;
    }

    function renderOrders(orders) {
        ordersList.replaceChildren();

        if (orders.length === 0) {
            ordersList.append(
                createElement(
                    "p",
                    "empty-state",
                    "You haven't placed any orders yet."
                )
            );

            return;
        }

        orders.forEach(order => {
            const card = createElement("article", "order-card");

            const orderId = order.orderNumber || order._id || "N/A";
            const status = String(order.orderStatus || "PENDING")
                .toLowerCase()
                .trim();
            const dateValue = order.createdAt || order.orderDate;
            let formattedDate = "Date unavailable";

            if (dateValue) {
                const date = new Date(dateValue);

                if (!Number.isNaN(date.getTime())) {
                    formattedDate = date.toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric"
                    });
                }
            }

            card.append(
                createElement("h3", "order-number", `Order #${orderId}`),
                createElement("p", "order-date", `Ordered on: ${formattedDate}`)
            );

            const statusLabel =
                status.charAt(0).toUpperCase() + status.slice(1);

            const statusElement = createElement(
                "p",
                "order-status",
                `Status: ${statusLabel}`
            );

            statusElement.dataset.status = status;
            card.append(statusElement);

            // DELIVERY PROGRESS
            const steps = ["pending", "confirmed", "shipped", "delivered"];
            const progressIndex = steps.indexOf(status);

            if (status === "cancelled") {
                card.append(
                    createElement(
                        "div",
                        "delivery-cancelled",
                        "Order cancelled."
                    )
                );
            } else {
                const progress = createElement("div", "delivery-progress");
                progress.setAttribute(
                    "aria-label",
                    `Delivery status: ${statusLabel}`
                );

                const progressTrack = createElement("div", "progress-track");
                const progressFill = createElement("div", "progress-fill");

                const percentage = progressIndex < 0
                    ? 0
                    : (progressIndex / (steps.length - 1)) * 100;

                progressFill.style.width = `${percentage}%`;

                progressTrack.append(progressFill);
                progress.append(progressTrack);

                const stepRow = createElement("div", "progress-steps");

                steps.forEach((step, index) => {
                    const stepElement = createElement("div", "progress-step");
                    const completed = progressIndex >= index;

                    if (completed) {
                        stepElement.classList.add("completed");
                    }

                    const circle = createElement(
                        "span",
                        "progress-circle",
                        completed ? "✓" : String(index + 1)
                    );

                    const label = createElement(
                        "span",
                        "progress-label",
                        step.charAt(0).toUpperCase() + step.slice(1)
                    );

                    stepElement.append(circle, label);
                    stepRow.append(stepElement);
                });

                progress.append(stepRow);
                card.append(progress);
            }

            // ORDER ITEMS
            const items = Array.isArray(order.items) ? order.items : [];
            const itemList = createElement("ul", "order-items");

            items.forEach(item => {
                const bookName =
                    item.title ||
                    item.bookTitle ||
                    item.book?.title ||
                    "Book";

                const quantity = Number(item.quantity) || 1;

                itemList.append(
                    createElement("li", "", `${bookName} × ${quantity}`)
                );
            });

            if (items.length > 0) {
                card.append(itemList);
            }

            // ORDER TOTAL
            const total = Number(
                order.totalAmount ?? order.totalPrice ?? order.total ?? 0
            );

            card.append(
                createElement(
                    "p",
                    "order-total",
                    `Total: ₹${total.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    })}`
                )
            );

            ordersList.append(card);
        });
    }
loadOrders();

// Refresh order statuses every 5 seconds without overlapping requests.
let refreshInProgress = false;

setInterval(async () => {
    if (refreshInProgress) return;

    refreshInProgress = true;

    try {
        await loadOrders();
    } finally {
        refreshInProgress = false;
    }
}, 5000);
});
