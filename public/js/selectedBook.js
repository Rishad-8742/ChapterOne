"use strict";

// SHARED HELPERS

const DEFAULT_COVER = "/images/default-book.jpg";

function formatPrice(value) {
    return `₹${Number(value || 0).toFixed(2)}`;
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function createElement(tag, className, text) {
    const node = document.createElement(tag);

    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;

    return node;
}

// Updates the navbar cart badge (these functions live in the shared navbar code).
async function refreshCartCount() {
    try {
        if (typeof window.updateCartCount === "function") {
            window.updateCartCount();
        }

        if (typeof updateNavbarCartCount === "function") {
            await updateNavbarCartCount();
        }
    } catch (error) {
        console.error("Cart count error:", error);
    }
}

async function addBookToCart(bookId, quantity) {
    const response = await fetch("/user/cart", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
        },
        credentials: "include",
        body: JSON.stringify({ bookId, quantity })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not add book to cart.");
    }

    return data;
}


document.addEventListener("DOMContentLoaded", () => {

    // DOM ELEMENTS

    const bookId = document.body.dataset.bookId;

    const bookImage = document.getElementById("bookImage");
    const imageCard = document.querySelector(".image-card");

    const coverThumbnails = document.getElementById("coverThumbnails");
    const frontThumb = document.getElementById("frontThumb");
    const frontThumbImage = document.getElementById("frontThumbImage");
    const backThumb = document.getElementById("backThumb");
    const backThumbImage = document.getElementById("backThumbImage");

    const bookTitle = document.getElementById("bookTitle");
    const bookAuthor = document.getElementById("bookAuthor");
    const bookGenre = document.getElementById("bookGenre");
    const bookPrice = document.getElementById("bookPrice");
    const bookDescription = document.getElementById("bookDescription");
    const descToggle = document.getElementById("descToggle");
    const bookSpecs = document.getElementById("bookSpecs");

    const breadcrumbGenre = document.getElementById("breadcrumbGenre");
    const breadcrumbTitle = document.getElementById("breadcrumbTitle");
    const stockNote = document.getElementById("stockNote");

    const quantityDisplay = document.getElementById("quantity");
    const decreaseBtn = document.getElementById("decreaseQty");
    const increaseBtn = document.getElementById("increaseQty");
    const addToCartBtn = document.getElementById("addToCartBtn");
    const addToCartLabel =
        document.getElementById("addToCartLabel") || addToCartBtn;
    const message = document.getElementById("message");

    const LONG_DESCRIPTION = 320;

    let selectedBook = null;
    let quantity = 1;
    let messageTimer = null;


    // MESSAGE

    function showMessage(text, isError = false) {
        if (!message) return;

        clearTimeout(messageTimer);

        message.textContent = text;
        message.classList.toggle("error", isError);

        // Success messages fade away; errors stay until the next action.
        if (text && !isError) {
            messageTimer = setTimeout(() => {
                message.textContent = "";
            }, 3500);
        }
    }


    // COVER GALLERY

    function showCover(which) {
        const src = which === "back"
            ? selectedBook?.image2
            : selectedBook?.image;

        if (!src || !bookImage) return;

        bookImage.src = src;
        bookImage.alt =
            `${selectedBook.title || "Book"} ${which === "back" ? "back" : "front"} cover`;

        frontThumb?.classList.toggle("active", which !== "back");
        backThumb?.classList.toggle("active", which === "back");
    }

    function setupGallery(book) {
        if (!bookImage) return;

        // A broken image falls back to the default cover once.
        bookImage.onerror = () => {
            bookImage.onerror = null;
            bookImage.src = DEFAULT_COVER;
        };

        const hasFront = Boolean(book.image);
        const hasBack = Boolean(book.image2);

        if (hasFront) {
            showCover("front");
        } else {
            bookImage.src = DEFAULT_COVER;
            bookImage.alt = `${book.title || "Book"} cover`;
        }

        // Thumbnails are only useful when there are two covers to switch between.
        if (coverThumbnails) coverThumbnails.hidden = !(hasFront && hasBack);

        if (frontThumbImage && hasFront) frontThumbImage.src = book.image;
        if (backThumbImage && hasBack) backThumbImage.src = book.image2;

        if (frontThumb) {
            frontThumb.hidden = !hasFront;
            frontThumb.onclick = () => showCover("front");
        }

        if (backThumb) {
            backThumb.hidden = !hasBack;
            backThumb.onclick = () => showCover("back");
        }
    }

    // STOCK
    function renderStock(stock) {
        if (!stockNote) return;

        stockNote.classList.remove("in-stock", "low-stock", "out-of-stock");

        if (stock <= 0) {
            stockNote.textContent = "Out of stock";
            stockNote.classList.add("out-of-stock");
        } else if (stock <= 5) {
            stockNote.textContent = `Only ${stock} left`;
            stockNote.classList.add("low-stock");
        } else {
            stockNote.textContent = "In stock · Ready to dispatch";
            stockNote.classList.add("in-stock");
        }
    }


    // DESCRIPTION + SPECS

    function renderDescription(text) {
        bookDescription.textContent = text;

        const isLong = text.length > LONG_DESCRIPTION;

        bookDescription.classList.toggle("is-clamped", isLong);

        if (!descToggle) return;

        descToggle.hidden = !isLong;
        descToggle.textContent = "Read more";
        descToggle.setAttribute("aria-expanded", "false");

        descToggle.onclick = () => {
            const expanded = bookDescription.classList.toggle("is-clamped") === false;

            descToggle.textContent = expanded ? "Show less" : "Read more";
            descToggle.setAttribute("aria-expanded", String(expanded));
        };
    }

    // Only fields the API actually returns are shown.
    function renderSpecs(book) {
        if (!bookSpecs) return;

        const rows = [
            ["Language", book.language],
            ["Pages", book.pages],
            ["Publisher", book.publisher],
            ["Published", book.publishedYear || book.year],
            ["ISBN", book.isbn]
        ].filter(([, value]) =>
            value !== undefined &&
            value !== null &&
            String(value).trim() !== ""
        );

        bookSpecs.replaceChildren();

        rows.forEach(([label, value]) => {
            const row = createElement("div", "spec-row");

            row.append(
                createElement("dt", "", label),
                createElement("dd", "", String(value))
            );

            bookSpecs.append(row);
        });

        bookSpecs.hidden = rows.length === 0;
    }

    // QUANTITY + ADD BUTTON STATE

    function updateQuantity() {
        if (!quantityDisplay || !decreaseBtn || !increaseBtn) {
            return;
        }

        quantityDisplay.textContent = quantity;

        const stock = Number(selectedBook?.stock || 0);

        decreaseBtn.disabled = quantity <= 1;

        increaseBtn.disabled =
            !selectedBook || quantity >= stock;
    }

    function restoreAddButton() {
        const stock = Number(selectedBook?.stock || 0);

        addToCartBtn.classList.remove("is-added");
        addToCartBtn.disabled = !selectedBook || stock <= 0;
        addToCartLabel.textContent = stock <= 0 ? "Out of Stock" : "Add to Cart";
    }

    // LOAD BOOK DETAILS

    async function loadBook() {
        try {
            if (!bookId) {
                throw new Error("Book ID is missing from the page.");
            }

            const response = await fetch(
                `/user/api/books/${encodeURIComponent(bookId)}`,
                {
                    headers: {
                        Accept: "application/json"
                    },
                    credentials: "include"
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success || !data.book) {
                throw new Error(
                    data.message || "Unable to load book."
                );
            }

            selectedBook = data.book;

            const title = selectedBook.title || "Untitled";

            // Book information
            bookTitle.textContent = title;
            bookAuthor.textContent = selectedBook.author || "Unknown Author";
            bookGenre.textContent = selectedBook.genre || "Unknown";
            bookPrice.textContent = formatPrice(selectedBook.price);

            renderDescription(
                selectedBook.description || "No description available."
            );

            renderSpecs(selectedBook);

            breadcrumbGenre.textContent = selectedBook.genre || "Books";
            breadcrumbTitle.textContent = title;

            document.title = `${title} | ChapterOne`;

            // Cover images
            setupGallery(selectedBook);

            // Stock information
            renderStock(Number(selectedBook.stock) || 0);

            quantity = 1;
            updateQuantity();
            restoreAddButton();

            // Load related books
            loadRelatedBooks(selectedBook);

        } catch (error) {
            console.error("Load book error:", error);

            bookTitle.textContent = "Book unavailable";
            renderDescription(error.message);

            if (stockNote) {
                stockNote.textContent = "";
                stockNote.className = "stock-badge";
            }

            addToCartBtn.disabled = true;
        }
    }


    // QUANTITY BUTTONS

    decreaseBtn.addEventListener("click", () => {
        if (quantity > 1) {
            quantity--;
            updateQuantity();
        }
    });

    increaseBtn.addEventListener("click", () => {
        const stock = Number(selectedBook?.stock || 0);

        if (selectedBook && quantity < stock) {
            quantity++;
            updateQuantity();
        }
    });


    // ADD TO CART

    addToCartBtn.addEventListener("click", async () => {
        if (!selectedBook) return;

        addToCartBtn.disabled = true;
        addToCartLabel.textContent = "Adding...";

        showMessage("");

        try {
            const data = await addBookToCart(selectedBook._id, quantity);

            showMessage(data.message || "Book added to cart!");

            await refreshCartCount();

            // Short confirmation on the button itself.
            addToCartBtn.classList.add("is-added");
            addToCartLabel.textContent = "Added ✓";

            await wait(1400);

        } catch (error) {
            console.error("Add to cart error:", error);
            showMessage(error.message, true);

        } finally {
            restoreAddButton();
        }
    });

    // IMAGE ZOOM (mouse devices only)

    if (
        imageCard &&
        bookImage &&
        window.matchMedia("(hover: hover)").matches
    ) {
        bookImage.addEventListener("mousemove", event => {
            if (!bookImage.src) return;

            const rect = bookImage.getBoundingClientRect();

            const x = ((event.clientX - rect.left) / rect.width) * 100;
            const y = ((event.clientY - rect.top) / rect.height) * 100;

            bookImage.style.transformOrigin = `${x}% ${y}%`;
            bookImage.style.transform = "scale(1.8)";
        });

        bookImage.addEventListener("mouseleave", () => {
            bookImage.style.transform = "scale(1)";
            bookImage.style.transformOrigin = "center center";
        });
    }

    // Load book when the page is ready
    loadBook();
});


// RELATED BOOKS

async function loadRelatedBooks(currentBook) {
    const container =
        document.getElementById("relatedBooksContainer");

    if (!container || !currentBook) return;

    function showNote(text) {
        container.replaceChildren(createElement("p", "related-empty", text));
    }

    try {
        const response = await fetch("/user/api/books", {
            method: "GET",
            headers: {
                Accept: "application/json"
            },
            credentials: "include"
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || "Failed to load related books."
            );
        }

        const currentGenre =
            String(currentBook.genre || "").trim().toLowerCase();

        const relatedBooks = (data.books || [])
            .filter(book =>
                String(book._id) !== String(currentBook._id) &&
                currentGenre !== "" &&
                String(book.genre || "").trim().toLowerCase() ===
                    currentGenre
            )
            .slice(0, 4);

        if (relatedBooks.length === 0) {
            showNote("No similar books are available right now.");
            return;
        }

        container.replaceChildren();

        relatedBooks.forEach(book => {
            const openBook = () => {
                window.location.href =
                    `/user/books/${encodeURIComponent(book._id)}`;
            };

            const card = createElement("article", "related-book-card");
            card.tabIndex = 0;
            card.setAttribute("role", "link");

            const image = document.createElement("img");
            image.src = book.image || DEFAULT_COVER;
            image.alt = book.title || "Book cover";
            image.loading = "lazy";

            image.onerror = function () {
                this.onerror = null;
                this.src = DEFAULT_COVER;
            };

            const title = createElement(
                "h3",
                "",
                book.title || "Untitled"
            );

            const author = createElement(
                "p",
                "related-author",
                book.author || "Unknown Author"
            );

            const price = createElement(
                "p",
                "related-price",
                formatPrice(book.price)
            );

            // Quick add to cart (does not open the book page)
            const addBtn = createElement(
                "button",
                "related-add-btn",
                "Add to cart"
            );
            addBtn.type = "button";

            const stock = Number(book.stock);

            if (Number.isFinite(stock) && stock <= 0) {
                addBtn.disabled = true;
                addBtn.textContent = "Out of stock";
            }

            addBtn.addEventListener("click", async event => {
                event.stopPropagation();

                addBtn.disabled = true;
                addBtn.textContent = "Adding...";

                let added = false;

                try {
                    await addBookToCart(book._id, 1);
                    await refreshCartCount();

                    added = true;
                    addBtn.textContent = "Added ✓";

                } catch (error) {
                    console.error("Related add to cart error:", error);
                    addBtn.textContent = "Try again";
                }

                await wait(1600);

                addBtn.textContent = "Add to cart";
                addBtn.disabled = false;

                if (added) addBtn.blur();
            });

            const bottom = createElement("div", "related-bottom");
            bottom.append(price, addBtn);

            card.append(image, title, author, bottom);

            card.addEventListener("click", openBook);

            card.addEventListener("keydown", event => {
                if (event.key === "Enter" && event.target === card) {
                    openBook();
                }
            });

            container.appendChild(card);
        });

    } catch (error) {
        console.error("Related books error:", error);

        showNote("Unable to load suggested books.");
    }
}

// Initial navbar cart count
refreshCartCount();