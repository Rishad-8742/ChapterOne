"use strict";

// DOM ELEMENTS

const cartItems = document.getElementById("cartItems");
const cartSubtitle = document.getElementById("cartSubtitle");
const summaryQuantity = document.getElementById("summaryQuantity");
const cartSubtotal = document.getElementById("cartSubtotal");
const cartTotal = document.getElementById("cartTotal");
const cartMessage = document.getElementById("cartMessage");
const checkoutBtn = document.getElementById("checkoutBtn");

// Cart badge in the navbar
const cartCount = document.getElementById("cartCount");

// Store the latest cart data returned by the server.
let cartData = {
    items: [],
    totalQuantity: 0,
    total: 0
};

let requestInProgress = false;
let messageTimer = null;


// ICONS (static markup only)

const ICONS = {
    trash:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>',

    bag:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M6 7h12l1 13H5L6 7Z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>'
};


// FORMAT PRICE

function formatPrice(price) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR"
    }).format(price);
}

// FETCH HELPER

async function sendRequest(url, options = {}) {
    const response = await fetch(url, {
        credentials: "include",
        ...options,
        headers: {
            ...(options.body
                ? { "Content-Type": "application/json" }
                : {}),
            ...options.headers
        }
    });

    const responseText = await response.text();

    let data;

    try {
        data = JSON.parse(responseText);
    } catch (error) {
        console.error("Invalid JSON response from:", url);
        console.error("HTTP status:", response.status);
        console.error("Response body:", responseText);

        throw new Error(
            `Server returned an invalid response (HTTP ${response.status}). Check the console.`
        );
    }

    if (!response.ok || !data.success) {
        throw new Error(data.message || "Request failed");
    }

    return data;
}


// DISPLAY MESSAGE
// type: "success" | "error"

function showMessage(message, type = "success") {
    clearTimeout(messageTimer);

    cartMessage.textContent = message;
    cartMessage.dataset.type = type;

    // Success messages fade away; errors stay until the next action.
    if (message && type === "success") {
        messageTimer = setTimeout(() => {
            cartMessage.textContent = "";
        }, 2800);
    }
}


// LOAD CART FROM SERVER

async function loadCart() {
    try {
        const data = await sendRequest("/user/cart/data");

        renderCart(data);

    } catch (error) {
        console.error("Load cart error:", error);

        showMessage(error.message, "error");

        const failed = document.createElement("p");
        failed.className = "loading";
        failed.textContent = "Unable to load your cart.";

        cartItems.replaceChildren(failed);

        if (cartSubtitle) cartSubtitle.textContent = "";
    }
}


// RENDER HELPERS

function renderEmptyCart() {
    const emptyCart = document.createElement("div");
    emptyCart.className = "empty-cart";

    const icon = document.createElement("div");
    icon.className = "empty-cart-icon";
    icon.innerHTML = ICONS.bag;

    const heading = document.createElement("h3");
    heading.textContent = "Your cart is empty";

    const description = document.createElement("p");
    description.textContent = "Discover your next favourite book.";

    const link = document.createElement("a");
    link.href = "/user/books";
    link.textContent = "Explore Books";

    emptyCart.append(icon, heading, description, link);

    return emptyCart;
}

function renderCartItem(book) {
    const row = document.createElement("article");
    row.className = "cart-item";
    row.dataset.bookId = book.bookId;

    // Book cover.
    const image = document.createElement("img");
    image.className = "book-cover";
    image.src = book.image || "/images/book-placeholder.png";
    image.alt = book.title;
    image.loading = "lazy";

    image.addEventListener("error", () => {
        image.removeAttribute("src");
        image.alt = "Book cover unavailable";
    }, { once: true });

    // Book details.
    const details = document.createElement("div");
    details.className = "book-details";

    const title = document.createElement("h3");
    title.textContent = book.title;

    const author = document.createElement("p");
    author.className = "book-author";
    author.textContent = `by ${book.author}`;

    const price = document.createElement("p");
    price.className = "book-price";
    price.textContent = `${formatPrice(book.price)} each`;

    details.append(title, author, price);

    // Quantity controls.
    const controls = document.createElement("div");
    controls.className = "quantity-controls";

    const decreaseBtn = document.createElement("button");
    decreaseBtn.type = "button";
    decreaseBtn.className = "quantity-btn";
    decreaseBtn.dataset.action = "decrease";
    decreaseBtn.textContent = "−";
    decreaseBtn.disabled = book.quantity <= 1;
    decreaseBtn.setAttribute(
        "aria-label",
        `Decrease quantity of ${book.title}`
    );

    const quantity = document.createElement("span");
    quantity.className = "quantity";
    quantity.textContent = book.quantity;

    const increaseBtn = document.createElement("button");
    increaseBtn.type = "button";
    increaseBtn.className = "quantity-btn";
    increaseBtn.dataset.action = "increase";
    increaseBtn.textContent = "+";
    increaseBtn.disabled = book.quantity >= book.stock;
    increaseBtn.setAttribute(
        "aria-label",
        `Increase quantity of ${book.title}`
    );

    controls.append(decreaseBtn, quantity, increaseBtn);
    details.append(controls);

    // Low-stock hint.
    const stock = Number(book.stock);

    if (Number.isFinite(stock) && stock > 0 && stock <= 5) {
        const note = document.createElement("p");
        note.className = "stock-note";
        note.textContent = `Only ${stock} left in stock`;
        details.append(note);
    }

    // Line total + remove.
    const subtotal = document.createElement("p");
    subtotal.className = "item-subtotal";
    subtotal.textContent = formatPrice(book.subtotal);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "remove-btn";
    removeBtn.dataset.action = "remove";
    removeBtn.setAttribute("aria-label", `Remove ${book.title} from cart`);
    removeBtn.innerHTML = `${ICONS.trash}<span>Remove</span>`;

    const actions = document.createElement("div");
    actions.className = "item-actions";
    actions.append(subtotal, removeBtn);

    row.append(image, details, actions);

    return row;
}


// RENDER CART

function renderCart(data) {
    cartData = data;

    const totalQuantity = Number(data.totalQuantity) || 0;

    // Update badge, summary and subtitle.
    if (cartCount) cartCount.textContent = totalQuantity;

    summaryQuantity.textContent = totalQuantity;
    cartSubtotal.textContent = formatPrice(data.total);
    cartTotal.textContent = formatPrice(data.total);

    checkoutBtn.disabled = data.items.length === 0;

    if (cartSubtitle) {
        cartSubtitle.textContent =
            totalQuantity === 0
                ? "Your cart is empty."
                : `${totalQuantity} ${totalQuantity === 1 ? "item" : "items"} in your cart`;
    }

    // Empty cart.
    if (data.items.length === 0) {
        cartItems.replaceChildren(renderEmptyCart());
        return;
    }

    const fragment = document.createDocumentFragment();

    data.items.forEach(book => {
        fragment.append(renderCartItem(book));
    });

    // Replace existing rows without reloading the page.
    cartItems.replaceChildren(fragment);
}

// INCREASE, DECREASE, REMOVE

cartItems.addEventListener("click", async function (event) {
    const button = event.target.closest("button[data-action]");

    if (!button || requestInProgress) {
        return;
    }

    const row = button.closest(".cart-item");

    if (!row) {
        return;
    }

    const bookId = row.dataset.bookId;
    const action = button.dataset.action;

    const book = cartData.items.find(
        item => item.bookId === bookId
    );

    if (!book) {
        return;
    }

    let quantity;

    if (action === "increase") {
        quantity = book.quantity + 1;
    } else if (action === "decrease") {
        quantity = book.quantity - 1;
    } else if (action === "remove") {
        quantity = null;
    } else {
        return;
    }

    if (
        quantity !== null &&
        (quantity < 1 || quantity > book.stock)
    ) {
        return;
    }

    requestInProgress = true;
    row.classList.add("is-updating");
    showMessage("");

    try {
        if (action === "remove") {
            await sendRequest(`/user/cart/${bookId}`, {
                method: "DELETE"
            });

            showMessage("Book removed from cart.");

        } else {
            await sendRequest(`/user/cart/${bookId}`, {
                method: "PATCH",
                body: JSON.stringify({ quantity })
            });

            showMessage("Cart updated.");
        }

        // Fetch the latest cart and recalculate totals.
        await loadCart();

    } catch (error) {
        console.error("Cart update error:", error);
        showMessage(error.message, "error");

    } finally {
        row.classList.remove("is-updating");
        requestInProgress = false;
    }
});


// PROCEED TO CHECKOUT

checkoutBtn.addEventListener("click", function () {
    if (requestInProgress || cartData.items.length === 0) {
        return;
    }

    window.location.href = "/user/checkout";
});

// INITIALIZE CART

loadCart();