"use strict";

const ordersBody = document.querySelector("#ordersBody");
const orderSearch = document.querySelector("#orderSearch");
const statusFilter = document.querySelector("#statusFilter");
const refreshOrdersBtn = document.querySelector("#refreshOrders");

const pageMessage = document.querySelector("#pageMessage");
const orderDetails = document.querySelector("#orderDetails");
const detailsTitle = document.querySelector("#detailsTitle");
const detailsContent = document.querySelector("#detailsContent");
const closeDetailsBtn = document.querySelector("#closeDetails");

const newOrderStatus = document.querySelector("#newOrderStatus");
const updateStatusBtn = document.querySelector("#updateStatusBtn");

const totalOrders = document.querySelector("#totalOrders");
const pendingOrders = document.querySelector("#pendingOrders");
const shippedOrders = document.querySelector("#shippedOrders");
const deliveredOrders = document.querySelector("#deliveredOrders");

let allOrders = [];
let selectedOrderId = null;
let loadingOrders = false;
let updatingStatus = false;

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[character];
    });
}

function formatPrice(value) {
    const amount = Number(value);

    if (!Number.isFinite(amount)) {
        return "₹0.00";
    }

    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR"
    }).format(amount);
}

function formatDate(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Unavailable";
    }

    return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function statusLabel(status) {
    return String(status || "PENDING")
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, character => character.toUpperCase());
}

function statusClass(status) {
    const allowed = [
        "PENDING",
        "CONFIRMED",
        "SHIPPED",
        "DELIVERED",
        "CANCELLED"
    ];

    const safeStatus = String(status || "PENDING").toUpperCase();

    return allowed.includes(safeStatus)
        ? `status-${safeStatus.toLowerCase()}`
        : "status-pending";
}

function showMessage(message, type = "success") {
    pageMessage.textContent = message;
    pageMessage.className = `message ${type}`;
}

function clearMessage() {
    pageMessage.textContent = "";
    pageMessage.className = "message";
}

async function sendRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        credentials: "include",
        headers: {
            Accept: "application/json",
            ...(options.body
                ? { "Content-Type": "application/json" }
                : {}),
            ...options.headers
        }
    });

    let data;

    try {
        data = await response.json();
    } catch {
        throw new Error(
            response.redirected
                ? "Your session may have expired. Please log in again."
                : "The server returned an invalid response."
        );
    }

    if (!response.ok || data.success === false) {
        throw new Error(data.message || "Request failed.");
    }

    return data;
}

// --------------------
// LOAD ALL ORDERS
// --------------------

async function loadOrders() {
    if (loadingOrders) {
        return;
    }

    loadingOrders = true;
    refreshOrdersBtn.disabled = true;

    ordersBody.innerHTML = `
        <tr>
            <td colspan="7" class="table-message">Loading orders...</td>
        </tr>
    `;

    try {
        const data = await sendRequest("/admin/orders/api");

        allOrders = Array.isArray(data.orders) ? data.orders : [];

        updateStatistics();
        renderOrders();

        if (selectedOrderId) {
            const selected = allOrders.find(
                order => order._id === selectedOrderId
            );

            if (selected) {
                await loadOrderDetails(selectedOrderId, false);
            } else {
                closeDetails();
            }
        }
    } catch (error) {
        ordersBody.innerHTML = `
            <tr>
                <td colspan="7" class="table-message">
                    ${escapeHTML(error.message)}
                </td>
            </tr>
        `;

        showMessage(error.message, "error");
    } finally {
        loadingOrders = false;
        refreshOrdersBtn.disabled = false;
    }
}

// --------------------
// UPDATE SUMMARY CARDS
// --------------------

function updateStatistics() {
    totalOrders.textContent = allOrders.length;

    pendingOrders.textContent = allOrders.filter(
        order => order.orderStatus === "PENDING"
    ).length;

    shippedOrders.textContent = allOrders.filter(
        order => order.orderStatus === "SHIPPED"
    ).length;

    deliveredOrders.textContent = allOrders.filter(
        order => order.orderStatus === "DELIVERED"
    ).length;
}

// --------------------
// SEARCH AND FILTER
// --------------------

function getFilteredOrders() {
    const search = orderSearch.value.trim().toLowerCase();
    const status = statusFilter.value;

    return allOrders.filter(order => {
        const customerName = order.user?.userName || "";
        const customerEmail = order.user?.userEmail || "";

        const searchText = [
            order._id,
            customerName,
            customerEmail
        ].join(" ").toLowerCase();

        const matchesSearch = searchText.includes(search);

        const matchesStatus =
            status === "ALL" || order.orderStatus === status;

        return matchesSearch && matchesStatus;
    });
}

// --------------------
// RENDER ORDERS TABLE
// --------------------

function renderOrders() {
    const orders = getFilteredOrders();

    if (!orders.length) {
        ordersBody.innerHTML = `
            <tr>
                <td colspan="7" class="table-message">
                    No matching orders found.
                </td>
            </tr>
        `;

        return;
    }

    ordersBody.innerHTML = orders.map(order => {
        const user = order.user || {};

        return `
            <tr>
                <td>
                    <span class="order-id">
                        #${escapeHTML(String(order._id).slice(-8).toUpperCase())}
                    </span>
                    <span class="muted">
                        ${escapeHTML(order._id)}
                    </span>
                </td>

                <td>
                    <span class="customer-name">
                        ${escapeHTML(user.userName || "Customer unavailable")}
                    </span>

                    <span class="customer-email">
                        ${escapeHTML(user.userEmail || "")}
                    </span>
                </td>

                <td>${escapeHTML(formatDate(order.createdAt))}</td>

                <td>
                    <strong>${formatPrice(order.totalAmount)}</strong>
                </td>

                <td>
                    ${escapeHTML(order.paymentMethod || "N/A")}
                    <span class="muted">
                        ${escapeHTML(order.paymentStatus || "N/A")}
                    </span>
                </td>

                <td>
                    <span class="status-badge ${statusClass(order.orderStatus)}">
                        ${escapeHTML(statusLabel(order.orderStatus))}
                    </span>
                </td>

                <td>
                    <button type="button"
                        class="view-button"
                        data-action="view"
                        data-id="${escapeHTML(order._id)}">
                        View
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

orderSearch.addEventListener("input", renderOrders);
statusFilter.addEventListener("change", renderOrders);
refreshOrdersBtn.addEventListener("click", loadOrders);

// --------------------
// LOAD ONE ORDER
// --------------------

async function loadOrderDetails(id, scroll = true) {
    clearMessage();

    detailsContent.innerHTML = `
        <p class="table-message">Loading order details...</p>
    `;

    orderDetails.hidden = false;
    selectedOrderId = id;

    if (scroll) {
        orderDetails.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    try {
        const data = await sendRequest(
            `/admin/orders/api/${encodeURIComponent(id)}`
        );

        renderOrderDetails(data.order);
    } catch (error) {
        detailsContent.innerHTML = `
            <p class="table-message">${escapeHTML(error.message)}</p>
        `;

        showMessage(error.message, "error");
    }
}

ordersBody.addEventListener("click", event => {
    const button = event.target.closest('button[data-action="view"]');

    if (!button) {
        return;
    }

    loadOrderDetails(button.dataset.id);
});

// --------------------
// RENDER ORDER DETAILS
// --------------------

function renderOrderDetails(order) {
    if (!order) {
        return;
    }

    const user = order.user || {};
    const shipping = order.shippingAddress || {};
    const items = Array.isArray(order.items) ? order.items : [];

    detailsTitle.textContent =
        `Order #${String(order._id).slice(-8).toUpperCase()}`;

    const itemsHTML = items.map(item => {
        const title = item.title || item.book?.title || "Book";
        const quantity = Number(item.quantity) || 0;
        const price = Number(item.price) || 0;

        const subtotal = Number.isFinite(Number(item.subtotal))
            ? Number(item.subtotal)
            : price * quantity;

        return `
            <tr>
                <td>${escapeHTML(title)}</td>
                <td>${quantity}</td>
                <td>${formatPrice(price)}</td>
                <td>${formatPrice(subtotal)}</td>
            </tr>
        `;
    }).join("");

    detailsContent.innerHTML = `
        <div class="details-grid">
            <div class="detail-box">
                <h3>Customer Information</h3>

                <p>
                    <strong>Name:</strong>
                    ${escapeHTML(user.userName || "Unavailable")}
                </p>

                <p>
                    <strong>Email:</strong>
                    ${escapeHTML(user.userEmail || "Unavailable")}
                </p>

                <p>
                    <strong>Order date:</strong>
                    ${escapeHTML(formatDate(order.createdAt))}
                </p>
            </div>

            <div class="detail-box">
                <h3>Shipping Address</h3>

                <p><strong>${escapeHTML(shipping.fullName || "N/A")}</strong></p>

                <p>${escapeHTML(shipping.phone || "")}</p>

                <p>${escapeHTML(shipping.address || "Address unavailable")}</p>

                <p>
                    ${escapeHTML(shipping.city || "")}
                    ${shipping.pincode
                        ? ` - ${escapeHTML(shipping.pincode)}`
                        : ""}
                </p>
            </div>

            <div class="detail-box">
                <h3>Payment Information</h3>

                <p>
                    <strong>Method:</strong>
                    ${escapeHTML(order.paymentMethod || "N/A")}
                </p>

                <p>
                    <strong>Payment status:</strong>
                    ${escapeHTML(order.paymentStatus || "N/A")}
                </p>

                <p>
                    <strong>Subtotal:</strong>
                    ${formatPrice(order.subtotal)}
                </p>

                <p>
                    <strong>Delivery fee:</strong>
                    ${formatPrice(order.deliveryFee)}
                </p>

                <p>
                    <strong>Total:</strong>
                    ${formatPrice(order.totalAmount)}
                </p>
            </div>

            <div class="detail-box">
                <h3>Current Delivery Status</h3>

                <p>
                    <span class="status-badge ${statusClass(order.orderStatus)}">
                        ${escapeHTML(statusLabel(order.orderStatus))}
                    </span>
                </p>
            </div>
        </div>

        <div class="detail-box">
            <h3>Purchased Books</h3>

            <div class="table-wrapper">
                <table class="items-table">
                    <thead>
                        <tr>
                            <th>Book</th>
                            <th>Qty</th>
                            <th>Unit Price</th>
                            <th>Subtotal</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${itemsHTML || `
                            <tr>
                                <td colspan="4">No item details available.</td>
                            </tr>
                        `}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    newOrderStatus.value = order.orderStatus || "PENDING";

    const isTerminal = ["DELIVERED", "CANCELLED"].includes(
        order.orderStatus
    );

    newOrderStatus.disabled = isTerminal;
    updateStatusBtn.disabled = isTerminal;

    updateStatusBtn.textContent = isTerminal
        ? "Order Closed"
        : "Update Status";
}

// --------------------
// CLOSE DETAILS
// --------------------

function closeDetails() {
    selectedOrderId = null;
    orderDetails.hidden = true;
    detailsContent.innerHTML = "";
}

closeDetailsBtn.addEventListener("click", closeDetails);

// --------------------
// UPDATE ORDER STATUS
// --------------------

updateStatusBtn.addEventListener("click", async () => {
    if (!selectedOrderId || updatingStatus) {
        return;
    }

    const order = allOrders.find(
        item => item._id === selectedOrderId
    );

    if (!order) {
        showMessage("Please refresh and select the order again.", "error");
        return;
    }

    const nextStatus = newOrderStatus.value;

    if (nextStatus === order.orderStatus) {
        showMessage("The order already has this status.", "error");
        return;
    }

    const confirmation = window.confirm(
        `Change order status from ${statusLabel(order.orderStatus)} to ${statusLabel(nextStatus)}?`
    );

    if (!confirmation) {
        newOrderStatus.value = order.orderStatus;
        return;
    }

    updatingStatus = true;
    updateStatusBtn.disabled = true;
    updateStatusBtn.textContent = "Updating...";

    try {
        const data = await sendRequest(
            `/admin/orders/api/${encodeURIComponent(selectedOrderId)}/status`,
            {
                method: "PATCH",
                body: JSON.stringify({
                    orderStatus: nextStatus
                })
            }
        );

        showMessage(data.message || "Order status updated.");

        await loadOrders();
    } catch (error) {
        showMessage(error.message, "error");

        newOrderStatus.value = order.orderStatus;
    } finally {
        updatingStatus = false;

        if (!["DELIVERED", "CANCELLED"].includes(order.orderStatus)) {
            updateStatusBtn.disabled = false;
        }

        updateStatusBtn.textContent = "Update Status";
    }
});

// Initial page load
loadOrders();