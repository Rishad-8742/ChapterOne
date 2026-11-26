"use strict";

const ordersBody = document.querySelector("#ordersBody");
const orderSearch = document.querySelector("#orderSearch");
const statusFilter = document.querySelector("#statusFilter");
const refreshOrdersBtn = document.querySelector("#refreshOrders");

const pageMessage = document.querySelector("#pageMessage");
const modalMessage = document.querySelector("#modalMessage");
const orderDetails = document.querySelector("#orderDetails");
const detailsTitle = document.querySelector("#detailsTitle");
const detailsDate = document.querySelector("#detailsDate");
const detailsBadge = document.querySelector("#detailsBadge");
const detailsContent = document.querySelector("#detailsContent");
const closeDetailsBtn = document.querySelector("#closeDetails");
const closeDetailsFooterBtn = document.querySelector("#closeDetailsFooter");

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

function statusKey(status) {
    const allowed = ["pending", "confirmed", "shipped", "delivered", "cancelled"];
    const key = String(status || "PENDING").toLowerCase();

    return allowed.includes(key) ? key : "pending";
}

// Message banner inside the modal for each status
const STATUS_BANNERS = {
    pending: {
        title: "Order pending",
        text: "This order is waiting to be confirmed.",
        icon: "clock"
    },
    confirmed: {
        title: "Order confirmed",
        text: "This order is confirmed and being prepared.",
        icon: "check"
    },
    shipped: {
        title: "Order shipped",
        text: "This order is on its way to the customer.",
        icon: "truck"
    },
    delivered: {
        title: "Order delivered",
        text: "This order has been delivered to the customer.",
        icon: "check"
    },
    cancelled: {
        title: "Order cancelled",
        text: "This order was cancelled and won't be delivered.",
        icon: "x"
    }
};

const ICONS = {
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    truck: '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7.5" cy="17.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    items: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    home: '<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-6h4v6"/>',
    card: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 5-5 8-5s6.5 1 8 5"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>'
};

function icon(name, size = 14) {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
}

function showMessage(message, type = "success") {
    pageMessage.textContent = message;
    pageMessage.className = `message ${type}`;

    // The modal covers the page message, so show it inside the modal too
    if (!orderDetails.hidden) {
        modalMessage.textContent = message;
        modalMessage.className = `message ${type}`;
    }
}

function clearMessage() {
    pageMessage.textContent = "";
    pageMessage.className = "message";

    modalMessage.textContent = "";
    modalMessage.className = "message";
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

// LOAD ALL ORDERS

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

// UPDATE SUMMARY CARDS

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

// SEARCH AND FILTER

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

// RENDER ORDERS TABLE

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

// MODAL OPEN / CLOSE

function openModal() {
    orderDetails.hidden = false;
    document.body.classList.add("modal-open");
}

function closeDetails() {
    selectedOrderId = null;
    orderDetails.hidden = true;
    document.body.classList.remove("modal-open");

    detailsContent.innerHTML = "";
    modalMessage.textContent = "";
    modalMessage.className = "message";
}

closeDetailsBtn.addEventListener("click", closeDetails);
closeDetailsFooterBtn.addEventListener("click", closeDetails);

orderDetails.addEventListener("click", event => {
    if (event.target.closest("[data-close-modal]")) {
        closeDetails();
    }
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !orderDetails.hidden) {
        closeDetails();
    }
});

// LOAD ONE ORDER

async function loadOrderDetails(id, firstOpen = true) {
    clearMessage();

    selectedOrderId = id;

    if (firstOpen) {
        detailsTitle.textContent = "Loading...";
        detailsDate.textContent = "";
        detailsBadge.textContent = "";
        detailsBadge.removeAttribute("data-status");

        detailsContent.innerHTML = `
            <p class="table-message">Loading order details...</p>
        `;
    }

    openModal();

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

// RENDER ORDER DETAILS

// Adjust these field names if your Book schema uses different ones
function itemImage(item) {
    const image =
        item.image ||
        item.coverImage ||
        item.book?.image ||
        item.book?.coverImage ||
        item.book?.images?.[0]?.url ||
        item.book?.images?.[0];

    return typeof image === "string" ? image : "";
}

function itemAuthor(item) {
    return item.author || item.book?.author || "";
}

function renderOrderDetails(order) {
    if (!order) {
        return;
    }

    const user = order.user || {};
    const shipping = order.shippingAddress || {};
    const items = Array.isArray(order.items) ? order.items : [];
    const key = statusKey(order.orderStatus);
    const banner = STATUS_BANNERS[key];

    // Header
    detailsTitle.textContent =
        `Order #${String(order._id).slice(-8).toUpperCase()}`;

    detailsDate.textContent = `Placed on ${formatDate(order.createdAt)}`;

    detailsBadge.textContent = statusLabel(order.orderStatus);
    detailsBadge.dataset.status = key;

    // Items
    const itemsHTML = items.map(item => {
        const title = item.title || item.book?.title || "Book";
        const author = itemAuthor(item);
        const image = itemImage(item);
        const quantity = Number(item.quantity) || 0;
        const price = Number(item.price) || 0;

        const subtotal = Number.isFinite(Number(item.subtotal))
            ? Number(item.subtotal)
            : price * quantity;

        return `
            <div class="order-item">
                <div class="order-item__thumb">
                    ${image
                        ? `<img src="${escapeHTML(image)}" alt="" loading="lazy">`
                        : icon("items", 18)}
                </div>

                <div class="order-item__info">
                    <strong>${escapeHTML(title)}</strong>
                    ${author ? `<span>${escapeHTML(author)}</span>` : ""}
                    <span>Qty ${quantity} × ${formatPrice(price)}</span>
                </div>

                <div class="order-item__total">${formatPrice(subtotal)}</div>
            </div>
        `;
    }).join("");

    detailsContent.innerHTML = `
        <div class="status-banner status-banner--${key}">
            <span class="status-banner__icon">${icon(banner.icon, 20)}</span>
            <div>
                <strong>${banner.title}</strong>
                <p>${banner.text}</p>
            </div>
        </div>

        <section class="modal-card">
            <div class="modal-card__title">
                <span class="modal-icon">${icon("items")}</span>
                Items
            </div>

            ${itemsHTML || `<p class="modal-muted">No item details available.</p>`}
        </section>

        <div class="modal-grid">
            <section class="modal-card">
                <div class="modal-card__title">
                    <span class="modal-icon">${icon("home")}</span>
                    Delivery address
                </div>

                <p class="modal-strong">${escapeHTML(shipping.fullName || "N/A")}</p>
                <p>${escapeHTML(shipping.address || "Address unavailable")}</p>
                <p>
                    ${escapeHTML(shipping.city || "")}${shipping.pincode
                        ? ` - ${escapeHTML(shipping.pincode)}`
                        : ""}
                </p>
                ${shipping.phone
                    ? `<p class="modal-muted">Phone: ${escapeHTML(shipping.phone)}</p>`
                    : ""}
            </section>

            <section class="modal-card">
                <div class="modal-card__title">
                    <span class="modal-icon">${icon("card")}</span>
                    Payment
                </div>

                <p class="modal-strong">${escapeHTML(order.paymentMethod || "N/A")}</p>
                <p class="modal-muted">
                    Status: ${escapeHTML(statusLabel(order.paymentStatus || "N/A"))}
                </p>
            </section>
        </div>

        <div class="modal-grid">
            <section class="modal-card">
                <div class="modal-card__title">
                    <span class="modal-icon">${icon("user")}</span>
                    Customer
                </div>

                <p class="modal-strong">${escapeHTML(user.userName || "Unavailable")}</p>
                <p class="modal-muted">${escapeHTML(user.userEmail || "Unavailable")}</p>
            </section>

            <section class="modal-card">
                <div class="modal-card__title">
                    <span class="modal-icon">${icon("receipt")}</span>
                    Summary
                </div>

                <div class="summary-row">
                    <span>Subtotal</span>
                    <span>${formatPrice(order.subtotal)}</span>
                </div>

                <div class="summary-row">
                    <span>Delivery fee</span>
                    <span>${formatPrice(order.deliveryFee)}</span>
                </div>

                <div class="summary-row summary-row--total">
                    <span>Total</span>
                    <span>${formatPrice(order.totalAmount)}</span>
                </div>
            </section>
        </div>
    `;

    // Status controls
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

// UPDATE ORDER STATUS

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

        await loadOrders();

        showMessage(data.message || "Order status updated.");
    } catch (error) {
        showMessage(error.message, "error");

        newOrderStatus.value = order.orderStatus;
    } finally {
        updatingStatus = false;

        const current = allOrders.find(
            item => item._id === selectedOrderId
        );

        const closed = current
            ? ["DELIVERED", "CANCELLED"].includes(current.orderStatus)
            : false;

        updateStatusBtn.disabled = closed;
        updateStatusBtn.textContent = closed
            ? "Order Closed"
            : "Update Status";
    }
});

// Initial page load
loadOrders();