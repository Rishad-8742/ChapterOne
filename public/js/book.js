// ELEMENTS
const searchInput =
    document.getElementById("searchInput");

const genreFilter =
    document.getElementById("genreFilter");

const languageFilter =
    document.getElementById("languageFilter");

const bookContainer =
    document.getElementById("bookContainer");

const loading =
    document.getElementById("loading");

const noBooks =
    document.getElementById("noBooks");

const bookCount =
    document.getElementById("bookCount");

const cartCount =
    document.getElementById("cartCount");


// BOOK DATA


let allBooks = [];

// LOAD BOOKS

async function loadBooks() {

    try {

        loading.style.display = "flex";

        noBooks.style.display = "none";

        bookContainer.innerHTML = "";


        const response = await fetch(
            "/user/api/books",
            {
                method: "GET",
                headers: {
                    "Accept": "application/json"
                },
                credentials: "include"
            }
        );


        const data =
            await response.json();


        console.log(
            "Books API response:",
            data
        );


        if (!response.ok || !data.success) {

            throw new Error(
                data.message ||
                "Failed to load books"
            );

        }


        allBooks =
            data.books || [];


        renderBooks();


    } catch (error) {

        console.error(
            "Load books error:",
            error
        );


        bookCount.textContent =
            "Unable to load books";


        bookContainer.innerHTML = `
            <p class="empty">
                Failed to load books.
            </p>
        `;


    } finally {

        loading.style.display = "none";

    }

}

// RENDER BOOKS


function renderBooks() {

    const searchText =
        searchInput.value
            .trim()
            .toLowerCase();


    const selectedGenre =
        genreFilter.value;


    const selectedLanguage =
        languageFilter.value;

        const maxPrice = priceRange
            ? Number(priceRange.value)
            : Infinity;

    // FILTER BOOKS

    const filteredBooks =
        allBooks.filter(book => {


            // TITLE

            const title =
                String(book.title || "")
                    .toLowerCase();


            // AUTHOR

            const author =
                String(book.author || "")
                    .toLowerCase();


            // GENRE

            const genre =
                String(book.genre || "");


            // LANGUAGE

            const language =
                String(book.language || "");


            // SEARCH

            const matchesSearch =
                title.includes(searchText) ||
                author.includes(searchText);


            // GENRE FILTER

            const matchesGenre =
                !selectedGenre ||
                genre === selectedGenre;


            // LANGUAGE FILTER

            const matchesLanguage =
                !selectedLanguage ||
                language === selectedLanguage;

                const matchesPrice =
                Number(book.price || 0) <= maxPrice;


            return (
            matchesSearch &&
            matchesGenre &&
            matchesLanguage &&
            matchesPrice
                    );

        });


    // CLEAR OLD BOOKS

    bookContainer.innerHTML = "";

    // NO BOOKS

    if (filteredBooks.length === 0) {

        noBooks.style.display = "block";

        bookCount.textContent =
            "0 books found";

        return;

    }


    noBooks.style.display = "none";

    // BOOK COUNT

    bookCount.textContent =
        `${filteredBooks.length} ${
            filteredBooks.length === 1
                ? "book"
                : "books"
        } found`;


    // CREATE BOOK CARDS

  // SORT BOOKS
const sortedBooks = sortBooks(filteredBooks);

// CREATE BOOK CARDS
sortedBooks.forEach(book => {

        const card =
            document.createElement("article");

        card.className =
            "book-card";


        const image =
            book.image
                ? book.image
                : "/images/default-book.jpg";


        card.innerHTML = `

            <div class="book-cover">

                <img
                    src="${escapeHTML(image)}"
                    alt="${escapeHTML(book.title || "Book")}"
                    onerror="this.src='/images/default-book.jpg'"
                >

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


                   <button
    type="button"
    class="add-cart-btn"
    onclick="addToCart('${book._id}')"
>
    Add to Cart
</button>
                </div>

            </div>

        `;


        // Open selected book page when clicking the card
card.style.cursor = "pointer";

card.addEventListener("click", () => {
    window.location.href = `/user/books/${encodeURIComponent(book._id)}`;
});

// Add to cart should not open the selected book page
const addCartBtn = card.querySelector(".add-cart-btn");

addCartBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    addToCart(book._id);
});

bookContainer.appendChild(card);

    });

}

// SEARCH

searchInput.addEventListener(
    "input",
    function () {

        renderBooks();

    }
);

// GENRE FILTER

genreFilter.addEventListener(
    "change",
    function () {

        renderBooks();

    }
);

// LANGUAGE FILTER

languageFilter.addEventListener(
    "change",
    function () {

        renderBooks();

    }
);

// ADD TO CART

async function addToCart(bookId) {

    try {

        const response =
            await fetch(
                "/user/cart",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    credentials: "include",

                    body: JSON.stringify({
                        bookId: bookId,
                        quantity: 1
                    })
                }
            );


        const data =
            await response.json();


        if (!response.ok || !data.success) {

            throw new Error(
                data.message ||
                "Could not add book to cart"
            );

        }


        updateCartCount();


        alert(
            "Book added to cart"
        );


    } catch (error) {

        console.error(
            "Add to cart error:",
            error
        );

        alert(
            error.message
        );

    }

}

// CART COUNT

async function updateCartCount() {

    try {

        const response =
            await fetch(
                "/user/cart/count",
                {
                    credentials: "include"
                }
            );


        if (!response.ok) {

            return;

        }


        const data =
            await response.json();


        if (
            data.success &&
            cartCount
        ) {

            cartCount.textContent =
                data.count || 0;

        }

    } catch (error) {

        console.error(
            "Cart count error:",
            error
        );

    }

}

// ESCAPE HTML

function escapeHTML(value) {

    return String(value)

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );

}


const sortFilter = document.getElementById("newest");

// SORT FILTER
if (sortFilter) {
    sortFilter.addEventListener("change", renderBooks);
}

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


// PRICE RANGE FILTER

const priceRange = document.getElementById("priceRange");
const priceValue = document.getElementById("priceValue");

if (priceRange && priceValue) {
    priceRange.addEventListener("input", function () {
        priceValue.textContent = `₹${this.value}`;

        renderBooks();
    });
}

// INITIAL LOAD
loadBooks();

updateCartCount();