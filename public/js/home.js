"use strict";

(() => {
    const PLACEHOLDER_IMAGE = "/images/book-placeholder.png";

    // =====================================
    // HELPERS
    // =====================================

    function formatPrice(value) {
        return "₹" + Number(value || 0).toLocaleString("en-IN");
    }

    let toastTimer;

    function showToast(message, type = "success") {
        let toast = document.getElementById("homeToast");

        if (!toast) {
            toast = document.createElement("div");
            toast.id = "homeToast";
            toast.setAttribute("role", "status");
            document.body.appendChild(toast);
        }

        toast.textContent = message;
        toast.className = `toast ${type}`;

        void toast.offsetWidth;
        toast.classList.add("show");

        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
    }

    // =====================================
    // CART BADGE
    // =====================================

    function findCartBadges() {
        const badges = new Set(
            document.querySelectorAll(
                "#cartCount, .cart-count, .cart-badge, [data-cart-count]"
            )
        );

        // fallback: a number inside any link that points to the cart
        if (badges.size === 0) {
            document.querySelectorAll('a[href*="cart"]').forEach(link => {
                link.querySelectorAll("span, b, i, em, small").forEach(element => {
                    if (/^\d+$/.test(element.textContent.trim())) {
                        badges.add(element);
                    }
                });
            });
        }

        return [...badges];
    }

    function setCartBadge(count) {
        findCartBadges().forEach(badge => {
            badge.textContent = count;
        });
    }

    async function updateCartCount() {
        try {
            const response = await fetch("/user/cart/data", {
                credentials: "include",
                headers: { Accept: "application/json" }
            });

            if (!response.ok) return;

            const data = await response.json();

            const count =
                Number(data.totalQuantity) ||
                (Array.isArray(data.items)
                    ? data.items.reduce(
                        (sum, item) => sum + (Number(item.quantity) || 0),
                        0
                    )
                    : 0);

            setCartBadge(count);
        } catch (error) {
            console.error("Cart count error:", error);
        }
    }

    // =====================================
    // ADD TO CART
    // =====================================

    async function addToCart(bookId, button) {
        const originalLabel = button.textContent;

        button.disabled = true;
        button.textContent = "Adding...";

        const restore = () => {
            button.textContent = originalLabel;
            button.classList.remove("is-added");
            button.disabled = false;
        };

        try {
            const response = await fetch("/user/cart/", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json"
                },
                body: JSON.stringify({ bookId, quantity: 1 })
            });

            const text = await response.text();

            let data = null;

            try {
                data = JSON.parse(text);
            } catch {
                // the server sent HTML, usually a redirect to the login page
            }

            console.log("Add to cart:", response.status, data || text.slice(0, 200));

           if (!data) {
    const loggedOut =
        response.redirected ||
        response.status === 401 ||
        /login/i.test(response.url);

    showToast(
        loggedOut
            ? "Please log in again to add books to your cart."
            : `Cart request failed (HTTP ${response.status}). Open the browser console for details.`,
        "error"
    );

    restore();
    return;
}

            if (!response.ok || data.success === false) {
                showToast(data.message || "Unable to add book to cart.", "error");
                restore();
                return;
            }

            button.textContent = "Added ✓";
            button.classList.add("is-added");
            showToast("Added to your cart");

            const countFromServer = Number(
                data.cartCount ?? data.totalQuantity ?? data.count
            );

            if (Number.isFinite(countFromServer) && countFromServer > 0) {
                setCartBadge(countFromServer);
            } else {
                updateCartCount();
            }

            setTimeout(restore, 1600);

        } catch (error) {
            console.error("Cart error:", error);
            showToast("Something went wrong. Please try again.", "error");
            restore();
        }
    }

    // =====================================
    // NEW ARRIVALS
    // =====================================

    function createBookCard(book, index) {
        const soldOut = Number(book.stock) <= 0;

        const card = document.createElement("article");
        card.className = "book-card" + (soldOut ? " is-soldout" : "");
        card.style.animationDelay = `${index * 0.1}s`;

        const cover = document.createElement("div");
        cover.className = "book-cover";

        const badge = document.createElement("span");
        badge.className = "book-badge" + (soldOut ? " is-soldout" : "");
        badge.textContent = soldOut ? "Sold out" : "New";

        const img = document.createElement("img");
        img.src = book.image || PLACEHOLDER_IMAGE;
        img.alt = book.title ? `${book.title} book cover` : "Book cover";
        img.loading = "lazy";

        img.onerror = () => {
            img.onerror = null;

            if (img.src.endsWith(PLACEHOLDER_IMAGE)) {
                img.style.display = "none";
                return;
            }

            img.src = PLACEHOLDER_IMAGE;
        };

        cover.append(badge, img);

        cover.addEventListener("click", () => {
            window.location.href = `/user/books/${book._id}`;
        });

        const details = document.createElement("div");
        details.className = "book-details";

        const author = document.createElement("p");
        author.className = "book-author";
        author.textContent = book.author || "Unknown author";

        const title = document.createElement("h3");
        title.className = "book-title";
        title.textContent = book.title || "Untitled";

        const bottom = document.createElement("div");
        bottom.className = "book-bottom";

        const price = document.createElement("span");
        price.className = "book-price";
        price.textContent = formatPrice(book.price);

        const button = document.createElement("button");
        button.className = "add-cart";
        button.type = "button";

        if (soldOut) {
            button.textContent = "Out of Stock";
            button.disabled = true;
        } else {
            button.textContent = "Add to Cart";
            button.addEventListener("click", event => {
                event.preventDefault();
                event.stopPropagation();
                addToCart(book._id, button);
            });
        }

        bottom.append(price, button);
        details.append(author, title, bottom);
        card.append(cover, details);

        return card;
    }

    async function loadNewArrivals() {
        const container = document.getElementById("newArrivalsContainer");

        if (!container) {
            console.error("newArrivalsContainer was not found in home.ejs");
            return;
        }

        try {
            const response = await fetch("/user/api/books/new-arrivals", {
                credentials: "include",
                headers: { Accept: "application/json" }
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || "Failed to load new arrivals");
            }

            const books = Array.isArray(data.books) ? data.books.slice(0, 3) : [];

            container.replaceChildren();

            if (books.length === 0) {
                const empty = document.createElement("p");
                empty.className = "grid-message";
                empty.textContent = "No new books available yet.";
                container.appendChild(empty);
                return;
            }

            books.forEach((book, index) => {
                container.appendChild(createBookCard(book, index));
            });

        } catch (error) {
            console.error("New arrivals error:", error);

            const message = document.createElement("p");
            message.className = "grid-message";
            message.textContent = "Unable to load new arrivals.";

            container.replaceChildren(message);
        }
    }

    // =====================================
    // SCROLL REVEAL
    // =====================================

    function initReveal() {
        if (!("IntersectionObserver" in window)) return;

        const observer = new IntersectionObserver(
            entries => {
                entries.forEach(entry => {
                    if (!entry.isIntersecting) return;

                    entry.target.classList.add("is-visible");
                    observer.unobserve(entry.target);
                });
            },
            { threshold: 0.12 }
        );

        document.querySelectorAll("[data-reveal]").forEach(element => {
            if (element.getBoundingClientRect().top < window.innerHeight * 0.9) {
                return;
            }

            element.classList.add("reveal");
            observer.observe(element);
        });
    }

    // =====================================
    // INIT
    // =====================================

    document.addEventListener("DOMContentLoaded", () => {
        initReveal();
        loadNewArrivals();
        updateCartCount();
    });
})();