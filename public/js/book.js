// ELEMENTS

const searchInput = document.getElementById("searchInput");
const genreFilter = document.getElementById("genreFilter");
const languageFilter = document.getElementById("languageFilter");
const sortFilter = document.getElementById("newest");

const priceRange = document.getElementById("priceRange");
const priceValue = document.getElementById("priceValue");
const priceMaxLabel = document.getElementById("priceMaxLabel");

const resetButton = document.getElementById("resetFilters");

const bookContainer = document.getElementById("bookContainer");
const loading = document.getElementById("loading");
const noBooks = document.getElementById("noBooks");
const bookCount = document.getElementById("bookCount");
const cartCount = document.getElementById("cartCount");


// STATE

const SORT_KEY = "chapterone:bookSort";

let allBooks = [];


// LOAD BOOKS

async function loadBooks() {

    try {

        loading.style.display = "flex";
        noBooks.style.display = "none";
        bookContainer.innerHTML = "";

        const response = await fetch("/user/api/books", {
            method: "GET",
            headers: { "Accept": "application/json" },
            credentials: "include"
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Failed to load books");
        }

        allBooks = data.books || [];

        syncPriceBounds();
        renderBooks();

    } catch (error) {

        console.error("Load books error:", error);

        bookCount.textContent = "Unable to load books";

        bookContainer.innerHTML = `
            <p class="empty">
                Failed to load books.
            </p>
        `;

    } finally {

        loading.style.display = "none";

    }

}


// PRICE RANGE

// Slider never hides expensive books: its max grows to fit the priciest book.
function syncPriceBounds() {

    if (!priceRange) return;

    const highest = allBooks.reduce(
        (max, book) => Math.max(max, Number(book.price || 0)),
        0
    );

    const max = Math.max(1000, Math.ceil(highest / 50) * 50);

    priceRange.max = max;
    priceRange.value = max;

    if (priceMaxLabel) priceMaxLabel.textContent = `₹${max}`;

    updatePriceUI();

}

function updatePriceUI() {

    if (!priceRange) return;

    const min = Number(priceRange.min) || 0;
    const max = Number(priceRange.max) || 1000;
    const value = Number(priceRange.value);

    const fill = max > min ? ((value - min) / (max - min)) * 100 : 100;

    priceRange.style.setProperty("--fill", `${fill}%`);

    if (priceValue) priceValue.textContent = `₹${value}`;

}


// SAVED SORT (remembered in this browser)

function saveSort() {

    try {
        localStorage.setItem(SORT_KEY, sortFilter.value);
    } catch (error) {
        // storage blocked: sorting still works, it just isn't remembered
    }

}

function restoreSort() {

    if (!sortFilter) return;

    try {

        const saved = localStorage.getItem(SORT_KEY);

        const isValid = [...sortFilter.options].some(
            option => option.value === saved
        );

        if (saved && isValid) sortFilter.value = saved;

    } catch (error) {
        // storage blocked: keep the default sort
    }

}


// RESET

function hasActiveFilters() {

    return Boolean(
        searchInput.value.trim() ||
        genreFilter.value ||
        languageFilter.value ||
        (sortFilter && sortFilter.value) ||
        (priceRange && Number(priceRange.value) < Number(priceRange.max))
    );

}

function updateResetButton() {

    if (resetButton) resetButton.hidden = !hasActiveFilters();

}

function resetFilters() {

    searchInput.value = "";
    genreFilter.value = "";
    languageFilter.value = "";

    if (sortFilter) {
        sortFilter.value = "";
        saveSort();
    }

    if (priceRange) priceRange.value = priceRange.max;

    updatePriceUI();
    renderBooks();

}


// RENDER BOOKS
// A book is out of stock only when the API sends a stock number of 0 or less.
function isOutOfStock(book) {

    if (
        book.stock === undefined ||
        book.stock === null ||
        book.stock === ""
    ) {
        return false;
    }

    const stock = Number(book.stock);

    return Number.isFinite(stock) && stock <= 0;

}
function renderBooks() {


    const searchText = searchInput.value.trim().toLowerCase();
    const selectedGenre = genreFilter.value;
    const selectedLanguage = languageFilter.value;

    const maxPrice = priceRange ? Number(priceRange.value) : Infinity;

    // FILTER BOOKS

    const filteredBooks = allBooks.filter(book => {

        const title = String(book.title || "").toLowerCase();
        const author = String(book.author || "").toLowerCase();
        const genre = String(book.genre || "");
        const language = String(book.language || "");

        const matchesSearch =
            title.includes(searchText) ||
            author.includes(searchText);

        const matchesGenre =
            !selectedGenre || genre === selectedGenre;

        const matchesLanguage =
            !selectedLanguage || language === selectedLanguage;

        const matchesPrice =
            Number(book.price || 0) <= maxPrice;

        return (
            matchesSearch &&
            matchesGenre &&
            matchesLanguage &&
            matchesPrice
        );

    });

    updateResetButton();

    // CLEAR OLD BOOKS

    bookContainer.innerHTML = "";

    // NO BOOKS

    if (filteredBooks.length === 0) {

        noBooks.style.display = "block";
        bookCount.textContent = "0 books found";

        return;

    }

    noBooks.style.display = "none";

    // BOOK COUNT

    bookCount.textContent =
        `${filteredBooks.length} ${
            filteredBooks.length === 1 ? "book" : "books"
        } found`;

    // SORT + CREATE BOOK CARDS
    // SORT + CREATE BOOK CARDS

    sortBooks(filteredBooks).forEach(book => {

        const outOfStock = isOutOfStock(book);

        const card = document.createElement("article");

        card.className =
            `book-card${outOfStock ? " is-out-of-stock" : ""}`;

        const image = book.image ? book.image : "/images/default-book.jpg";

        card.innerHTML = `

            <div class="book-cover">

                <img
                    src="${escapeHTML(image)}"
                    alt="${escapeHTML(book.title || "Book")}"
                    onerror="this.src='/images/default-book.jpg'"
                >

                ${outOfStock
                    ? '<span class="stock-tag">Out of stock</span>'
                    : ""}

            </div>


            <div class="book-info">

                <h3 class="book-title">
                    ${escapeHTML(book.title || "Untitled")}
                </h3>


                <p class="book-author">
                    ${escapeHTML(book.author || "Unknown Author")}
                </p>


                <div class="book-meta">

                    <span class="book-genre">
                        ${escapeHTML(book.genre || "Unknown")}
                    </span>

                    <span class="book-language">
                        ${escapeHTML(book.language || "Unknown")}
                    </span>

                </div>


                <div class="book-bottom">

                    <span class="book-price">
                        ₹${Number(book.price || 0).toFixed(2)}
                    </span>

                    <button type="button" class="add-cart-btn">
                        Add to Cart
                    </button>

                </div>

            </div>

        `;

        // Open the selected book page when clicking the card
        card.addEventListener("click", () => {
            window.location.href =
                `/user/books/${encodeURIComponent(book._id)}`;
        });

        // Add to cart should not open the selected book page
        const addCartBtn = card.querySelector(".add-cart-btn");

        if (outOfStock) {
            addCartBtn.disabled = true;
        }

        addCartBtn.addEventListener("click", (event) => {
            event.stopPropagation();

            if (!outOfStock) addToCart(book._id);
        });

        bookContainer.appendChild(card);

    });
    
}


// SORT

function sortBooks(books) {

    const sortValue = sortFilter?.value || "";

    const sortedBooks = [...books];

    switch (sortValue) {

        case "price-low":
            sortedBooks.sort(
                (a, b) => Number(a.price || 0) - Number(b.price || 0)
            );
            break;

        case "price-high":
            sortedBooks.sort(
                (a, b) => Number(b.price || 0) - Number(a.price || 0)
            );
            break;

        case "az":
            sortedBooks.sort(
                (a, b) =>
                    String(a.title || "").localeCompare(
                        String(b.title || "")
                    )
            );
            break;

    }

    return sortedBooks;

}


// EVENTS

searchInput.addEventListener("input", renderBooks);
genreFilter.addEventListener("change", renderBooks);
languageFilter.addEventListener("change", renderBooks);

if (sortFilter) {
    sortFilter.addEventListener("change", () => {
        saveSort();
        renderBooks();
    });
}

if (priceRange) {
    priceRange.addEventListener("input", () => {
        updatePriceUI();
        renderBooks();
    });
}

if (resetButton) {
    resetButton.addEventListener("click", resetFilters);
}


// ADD TO CART

async function addToCart(bookId) {

    try {

        const response = await fetch("/user/cart", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
                bookId: bookId,
                quantity: 1
            })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Could not add book to cart");
        }

        updateCartCount();

        alert("Book added to cart");

    } catch (error) {

        console.error("Add to cart error:", error);

        alert(error.message);

    }

}


// CART COUNT

async function updateCartCount() {

    try {

        const response = await fetch("/user/cart/count", {
            credentials: "include"
        });

        if (!response.ok) return;

        const data = await response.json();

        if (data.success && cartCount) {
            cartCount.textContent = data.count || 0;
        }

    } catch (error) {

        console.error("Cart count error:", error);

    }

}


// ESCAPE HTML

function escapeHTML(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


// INITIAL LOAD

restoreSort();
updatePriceUI();

loadBooks();
updateCartCount();