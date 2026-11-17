"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const ordersList = document.getElementById("ordersList");
    if (!ordersList) return;

    const messageEl = document.getElementById("ordersMessage");
    const countEl = document.getElementById("ordersCount");
    const filterButtons = document.querySelectorAll(".filter-btn");
    const modal = document.getElementById("orderModal");
    const modalDialog = modal.querySelector(".order-modal-dialog");
    const modalBody = document.getElementById("orderModalBody");
    const modalTitle = document.getElementById("orderModalTitle");
    const modalSub = document.getElementById("orderModalSub");

    const STEPS = ["pending", "confirmed", "shipped", "delivered"];
    const POLL_MS = 5000;

    let orders = [];
    let activeFilter = "all";
    let openOrderId = null;
    let lastTrigger = null;
    let lastSignature = "";

    /* ---------- helpers ---------- */

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined && text !== null) node.textContent = text;
        return node;
    }

    const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

    function getId(order) {
        return String(order._id || order.id || order.orderNumber || "");
    }

    function displayNumber(order) {
        if (order.orderNumber) return `#${String(order.orderNumber).replace(/^#/, "")}`;
        return `#${getId(order).slice(-8).toUpperCase() || "N/A"}`;
    }

    function getStatus(order) {
        return String(order.orderStatus || "pending").toLowerCase().trim();
    }

    function formatDate(value, withTime) {
        if (!value) return "Date unavailable";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "Date unavailable";
        const opts = { day: "2-digit", month: "short", year: "numeric" };
        if (withTime) { opts.hour = "2-digit"; opts.minute = "2-digit"; }
        return date.toLocaleString("en-IN", opts);
    }

    function money(value) {
        return `₹${Number(value || 0).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    }

    function orderDate(order) {
        return order.createdAt || order.orderDate;
    }

    function orderTotal(order) {
        return Number(order.totalAmount ?? order.totalPrice ?? order.total ?? 0);
    }

    function itemsOf(order) {
        const list = Array.isArray(order.items) ? order.items : [];
        return list.map(item => {
            const price = item.price ?? item.book?.price ?? item.unitPrice;
            const image = item.image || item.coverImage || item.book?.coverImage || item.book?.image || "";
            return {
                name: item.title || item.bookTitle || item.book?.title || "Book",
                author: item.author || item.book?.author || "",
                qty: Number(item.quantity) || 1,
                price: price === undefined || price === null || price === "" ? null : Number(price),
                image: typeof image === "string" && /^(\/|https?:\/\/)/.test(image) ? image : ""
            };
        });
    }

    function matchesFilter(status) {
        if (activeFilter === "all") return true;
        if (activeFilter === "active") return STEPS.slice(0, 3).includes(status);
        return status === activeFilter;
    }

    function showMessage(text) {
        if (!messageEl) return;
        messageEl.textContent = text || "";
        messageEl.classList.toggle("show", Boolean(text));
        messageEl.classList.toggle("error", Boolean(text));
    }

    /* ---------- summary cards ---------- */

    function buildCard(order) {
        const status = getStatus(order);
        const items = itemsOf(order);
        const totalQty = items.reduce((n, i) => n + i.qty, 0);
        const card = el("article", "order-card");
        card.dataset.status = status;

        const info = el("div", "order-card-info");
        info.append(
            el("h3", "order-number", displayNumber(order)),
            el("p", "order-date", `${formatDate(orderDate(order))} · ${totalQty} item${totalQty === 1 ? "" : "s"}`)
        );

        const pill = el("span", "order-status", cap(status));
        pill.dataset.status = status;

        const total = el("strong", "order-total", money(orderTotal(order)));

        const btn = el("button", "primary-button order-view-btn", "View details");
        btn.type = "button";
        btn.dataset.orderId = getId(order);
        btn.setAttribute("aria-haspopup", "dialog");

        card.append(info, pill, total, btn);
        return card;
    }

    function renderList() {
        const visible = orders.filter(o => matchesFilter(getStatus(o)));
        ordersList.replaceChildren();

        if (countEl) {
            countEl.textContent = orders.length
                ? `${visible.length} of ${orders.length} order${orders.length === 1 ? "" : "s"}`
                : "";
        }

        if (orders.length === 0) {
            ordersList.append(el("p", "empty-state", "You haven't placed any orders yet."));
            return;
        }
        if (visible.length === 0) {
            ordersList.append(el("p", "empty-state", "No orders match this filter."));
            return;
        }
        visible.forEach(o => ordersList.append(buildCard(o)));
    }

    /* ---------- modal ---------- */

    const STATUS_COPY = {
        pending:   { icon: "…", title: "Order received",  text: "We've got your order and it's waiting for confirmation." },
        confirmed: { icon: "✓", title: "Order confirmed", text: "Your books are confirmed and being packed." },
        shipped:   { icon: "➤", title: "On the way",      text: "Your order has left us and is heading to you." },
        delivered: { icon: "★", title: "Delivered",       text: "Your order has arrived. Happy reading!" },
        cancelled: { icon: "✕", title: "Order cancelled", text: "This order was cancelled and won't be delivered." }
    };

    function buildBanner(status) {
        const copy = STATUS_COPY[status] || STATUS_COPY.pending;
        const banner = el("div", "status-banner");
        banner.dataset.status = status;
        const text = el("div", "status-banner-text");
        text.append(el("p", "status-banner-title", copy.title), el("p", "status-banner-desc", copy.text));
        banner.append(el("span", "status-banner-icon", copy.icon), text);
        return banner;
    }

    function buildTracker(status) {
        if (status === "cancelled") return null;
        const idx = STEPS.indexOf(status);
        const wrap = el("ol", "tracker");
        wrap.setAttribute("aria-label", `Delivery status: ${cap(status)}`);

        STEPS.forEach((step, i) => {
            const done = idx >= i;
            const li = el("li", "tracker-step");
            if (done) li.classList.add("completed");
            if (idx === i) li.classList.add("current");
            li.append(
                el("span", "tracker-circle", done ? "✓" : String(i + 1)),
                el("span", "tracker-label", cap(step))
            );
            wrap.append(li);
        });
        return wrap;
    }

    function section(title) {
        const s = el("section", "modal-section");
        s.dataset.section = title.toLowerCase().split(" ")[0];
        s.append(el("h3", "modal-section-title", title));
        return s;
    }

    function buildItems(items) {
        const s = section("Items");
        if (items.length === 0) {
            s.append(el("p", "empty-state", "No item details available."));
            return s;
        }
        const list = el("ul", "modal-items");
        items.forEach(item => {
            const li = el("li", "modal-item");
            const thumb = el("div", "modal-item-thumb");
            if (item.image) {
                const img = document.createElement("img");
                img.src = item.image;
                img.alt = "";
                img.loading = "lazy";
                thumb.append(img);
            } else {
                thumb.textContent = item.name.charAt(0).toUpperCase();
            }
            const info = el("div", "modal-item-info");
            info.append(el("p", "modal-item-name", item.name));
            if (item.author) info.append(el("p", "modal-item-meta", item.author));
            info.append(el("p", "modal-item-meta", item.price !== null
                ? `Qty ${item.qty} × ${money(item.price)}`
                : `Qty ${item.qty}`));
            li.append(thumb, info);
            if (item.price !== null) li.append(el("p", "modal-item-price", money(item.price * item.qty)));
            list.append(li);
        });
        s.append(list);
        return s;
    }

    function buildAddress(order) {
        const a = order.shippingAddress || order.deliveryAddress || order.address;
        if (!a) return null;
        const s = section("Delivery address");
        if (typeof a === "string") {
            s.append(el("p", "modal-text", a));
            return s;
        }
        const name = a.fullName || a.name;
        const phone = a.phone || a.mobile;
        const line1 = [a.addressLine1 || a.street || a.line1, a.addressLine2 || a.line2].filter(Boolean).join(", ");
        const area = [a.landmark, a.city, a.state].filter(Boolean).join(", ");
        const pin = a.pincode || a.postalCode || a.zip;
        const line2 = [area, pin].filter(Boolean).join(" - ");

        if (name) s.append(el("p", "modal-text strong", name));
        [line1, line2].filter(Boolean).forEach(l => s.append(el("p", "modal-text", l)));
        if (phone) s.append(el("p", "modal-text muted", `Phone: ${phone}`));
        return s;
    }

    function buildPayment(order) {
        const method = order.paymentMethod || order.payment?.method;
        const pStatus = order.paymentStatus || order.payment?.status;
        if (!method && !pStatus) return null;
        const s = section("Payment");
        if (method) s.append(el("p", "modal-text strong", String(method).toUpperCase() === "COD" ? "Cash on delivery" : cap(String(method))));
        if (pStatus) s.append(el("p", "modal-text muted", `Status: ${cap(String(pStatus).toLowerCase())}`));
        return s;
    }

    function buildSummary(order, items) {
        const s = section("Order summary");
        const box = el("dl", "modal-summary");
        const row = (label, value, cls) => {
            const r = el("div", `modal-summary-row${cls ? " " + cls : ""}`);
            r.append(el("dt", "", label), el("dd", "", value));
            box.append(r);
        };

        const priced = items.length > 0 && items.every(i => i.price !== null);
        const subtotal = order.subtotal ?? (priced ? items.reduce((n, i) => n + i.price * i.qty, 0) : null);
        const shipping = order.shippingCharge ?? order.shippingFee ?? order.deliveryCharge;
        const discount = order.discount ?? order.discountAmount;

        if (subtotal !== null && subtotal !== undefined) row("Subtotal", money(subtotal));
        if (shipping !== undefined && shipping !== null) row("Shipping", Number(shipping) === 0 ? "Free" : money(shipping));
        if (discount && Number(discount) > 0) row("Discount", `− ${money(discount)}`);
        row("Total", money(orderTotal(order)), "total");

        s.append(box);
        return s;
    }

    function renderModal(order) {
        const status = getStatus(order);
        const items = itemsOf(order);

        modalTitle.textContent = `Order ${displayNumber(order)}`;
        modalSub.textContent = `Placed on ${formatDate(orderDate(order), true)}`;

        const frag = document.createDocumentFragment();

        // Status pill lives in the gradient header
        let headStatus = modal.querySelector(".order-modal-status");
        if (!headStatus) {
            headStatus = el("span", "order-modal-status");
            modalSub.parentElement.append(headStatus);
        }
        headStatus.textContent = cap(status);
        headStatus.dataset.status = status;

        frag.append(buildBanner(status));
        const tracker = buildTracker(status);
        if (tracker) frag.append(tracker);
        frag.append(buildItems(items));

        const addr = buildAddress(order);
        const pay = buildPayment(order);
        if (addr || pay) {
            const grid = el("div", "modal-info-grid");
            if (addr) grid.append(addr);
            if (pay) grid.append(pay);
            frag.append(grid);
        }

        frag.append(buildSummary(order, items));
        
if (["pending", "confirmed"].includes(status)) {
    const actions = el("div", "modal-actions");

    const cancelBtn = el(
        "button",
        "danger-button cancel-order-btn",
        "Cancel Order"
    );

    cancelBtn.type = "button";
    cancelBtn.dataset.orderId = getId(order);

    actions.append(cancelBtn);
    frag.append(actions);
}

        modalBody.replaceChildren(frag);
    }

    function openModal(id, trigger) {
        const order = orders.find(o => getId(o) === id);
        if (!order) return;
        openOrderId = id;
        lastTrigger = trigger || null;
        renderModal(order);
        modalBody.scrollTop = 0;
        modal.hidden = false;
        document.body.classList.add("modal-open");
        modalDialog.focus();
    }

    function closeModal() {
        if (modal.hidden) return;
        modal.hidden = true;
        openOrderId = null;
        document.body.classList.remove("modal-open");
        if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus();
        lastTrigger = null;
    }

    /* ---------- events ---------- */

    ordersList.addEventListener("click", e => {
        const btn = e.target.closest(".order-view-btn");
        if (btn) openModal(btn.dataset.orderId, btn);
    });

    modal.addEventListener("click", e => {
        if (e.target.closest("[data-close-modal]")) closeModal();
    });

    document.addEventListener("keydown", e => {
        if (modal.hidden) return;
        if (e.key === "Escape") {
            closeModal();
            return;
        }
        if (e.key === "Tab") {
            const focusable = modalDialog.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey && (document.activeElement === first || document.activeElement === modalDialog)) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    });

    filterButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            activeFilter = btn.dataset.status;
            filterButtons.forEach(b => {
                const on = b === btn;
                b.classList.toggle("active", on);
                b.setAttribute("aria-pressed", String(on));
            });
            renderList();
        });
    });

    /* ---------- data ---------- */

    async function loadOrders() {
        try {
            const response = await fetch("/user/api/orders", {
                method: "GET",
                credentials: "include",
                headers: { Accept: "application/json" },
                cache: "no-store"
            });
            const data = await response.json();

            if (!response.ok || data.success !== true) {
                throw new Error(data.message || "Unable to load orders.");
            }
            if (!Array.isArray(data.orders)) {
                throw new Error("Invalid orders response from server.");
            }

            showMessage("");

            // Only touch the DOM when something actually changed,
            // so polling never flickers the list or disturbs an open modal.
            const signature = JSON.stringify(data.orders);
            if (signature === lastSignature) return;
            lastSignature = signature;
            orders = data.orders;

            renderList();
            if (openOrderId) {
                const current = orders.find(o => getId(o) === openOrderId);
                if (current) {
                    const scroll = modalBody.scrollTop;
                    renderModal(current);
                    modalBody.scrollTop = scroll;
                }
            }
        } catch (error) {
            console.error("Orders error:", error);
            if (orders.length === 0) {
                ordersList.replaceChildren(el("p", "empty-state", error.message || "Unable to load orders."));
            } else {
                showMessage("Couldn't refresh your orders. Showing the last loaded data.");
            }
        }
    }

modal.addEventListener("click", async (e) => {
    const btn = e.target.closest(".cancel-order-btn");

    if (!btn) return;

    const orderId = btn.dataset.orderId;

    if (!orderId) return;

    const confirmed = confirm(
        "Are you sure you want to cancel this order?"
    );

    if (!confirmed) return;

    btn.disabled = true;
    btn.textContent = "Cancelling...";

    try {
        const response = await fetch(
            `/user/api/orders/${orderId}/cancel`,
            {
                method: "PATCH",
                credentials: "include",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    reason: "Cancelled by customer"
                })
            }
        );

        const data = await response.json();

        if (!response.ok || data.success !== true) {
            throw new Error(
                data.message || "Unable to cancel order."
            );
        }

        // Update local order data
        const order = orders.find(
            o => getId(o) === orderId
        );

        if (order) {
            order.orderStatus = "CANCELLED";
        }

        // Refresh order list
        renderList();

        // Refresh currently opened modal
        const updatedOrder = orders.find(
            o => getId(o) === orderId
        );

        if (updatedOrder) {
            renderModal(updatedOrder);
        }

        showMessage(data.message);

    } catch (error) {
        console.error("Cancellation error:", error);

        showMessage(error.message);

        btn.disabled = false;
        btn.textContent = "Cancel Order";
    }
});

    // Poll every 5s, one request at a time, paused while the tab is hidden.
    async function poll() {
        if (!document.hidden) await loadOrders();
        setTimeout(poll, POLL_MS);
    }

    loadOrders().then(() => setTimeout(poll, POLL_MS));
});