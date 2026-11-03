console.log("CHAPTERONE HOME JS LOADED");
const bookContainer =
    document.getElementById("bookContainer");

const bookLoading =
    document.getElementById("bookLoading");

const bookError =
    document.getElementById("bookError");

const cartCount =
    document.getElementById("cartCount");



const newArrivalsContainer =
    document.getElementById("bookContainer");

const newArrivalsLoading =
    document.getElementById("bookLoading");

const newArrivalsError =
    document.getElementById("bookError");

// EXPLORE BUTTON

const exploreBooksBtn = document.getElementById("exploreBooksBtn");
const discoverBtn = document.getElementById("discoverBtn");

if (exploreBooksBtn) {
    exploreBooksBtn.addEventListener("click", () => {
        window.location.href = "/user/books";
    });
}

if (discoverBtn) {
    discoverBtn.addEventListener("click", () => {
        window.location.href = "/user/books";
    });
}

// FETCH FEATURED BOOKS

async function loadFeaturedBooks() {

    try {

        const response =
            await fetch("/user/api/books/featured");


        if (!response.ok) {

            throw new Error(
                "Failed to fetch books"
            );

        }


        const data =
            await response.json();


        if (!data.success) {

            throw new Error(
                data.message
            );

        }


        displayBooks(data.books);


    } catch (error) {

        console.error(
            "Featured books error:",
            error
        );


        bookLoading.style.display =
            "none";


        bookError.textContent =
            "Unable to load books.";

    }

}

// DISPLAY BOOKS

function displayBooks(books) {

    bookLoading.style.display =
        "none";


    bookContainer.innerHTML = "";


    books.forEach(book => {

        const card =
            document.createElement("article");


        card.className =
            "book-card";


        card.innerHTML = `

            <div class="book-cover">

                <img
                    src="${book.image}"
                    alt="${book.title}"
                    loading="lazy"
                >

            </div>


            <div class="book-details">

                <p class="book-author">
                    ${book.author}
                </p>


                <h3 class="book-title">
                    ${book.title}
                </h3>


                <div class="book-bottom">

                    <span class="book-price">
                        ₹${book.price}
                    </span>


                    <button
                        class="add-cart"
                        data-id="${book._id}"
                    >
                        Add to Cart
                    </button>

                </div>

            </div>

        `;


        // BOOK CLICK

        card
            .querySelector(".book-cover")
            .addEventListener(
                "click",
                () => {

                    window.location.href =
                        `/user/books/${book._id}`;

                }
            );


        // CART CLICK

        card
            .querySelector(".add-cart")
            .addEventListener(
                "click",
                (event) => {

                    event.stopPropagation();

                    addToCart(book._id);

                }
            );


        bookContainer.appendChild(card);

    });

}

// ADD TO CART

async function addToCart(bookId) {

    try {

        const response =
            await fetch(
                "/user/cart/add",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        bookId: bookId,
                        quantity: 1
                    })
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            alert(
                data.message ||
                "Unable to add book"
            );

            return;

        }


        if (data.success) {

            await loadCartCount();

        }

    } catch (error) {

        console.error(
            "Cart error:",
            error
        );

    }

}

// CART COUNT

async function loadNewArrivals() {
    const container = document.getElementById("newArrivalsContainer");

    console.log("New Arrivals container:", container);

    if (!container) {
        console.error("newArrivalsContainer was not found in home.ejs");
        return;
    }

    try {
        const response = await fetch("/user/api/books/new-arrivals", {
            credentials: "include"
        });

        console.log("API status:", response.status);

        const data = await response.json();

        console.log("API data:", data);

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Failed to load new arrivals");
        }

        container.replaceChildren();

        const books = data.books.slice(0, 3);

        if (books.length === 0) {
            container.textContent = "No new books available yet.";
            return;
        }

        books.forEach(book => {
            const card = document.createElement("article");
            card.className = "book-card";

            const cover = document.createElement("div");
            cover.className = "book-cover";

            const img = document.createElement("img");
            img.src = book.image || "/images/book-placeholder.png";
            img.alt = book.title || "Book cover";
            img.loading = "lazy";

            img.onerror = () => {
                img.onerror = null;
                img.style.objectFit = "contain";
                img.alt = "Book cover unavailable";
                console.error("Book image failed:", img.src);
            };

            cover.appendChild(img);

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
            price.textContent = `₹${book.price}`;

            const button = document.createElement("button");
            button.className = "add-cart";
            button.type = "button";
            button.textContent = "Add to Cart";

            if (Number(book.stock) <= 0) {
                button.textContent = "Out of Stock";
                button.disabled = true;
            } else {
                button.addEventListener("click", event => {
                    event.stopPropagation();
                    addToCart(book._id);
                });
            }

            bottom.append(price, button);
            details.append(author, title, bottom);
            card.append(cover, details);

            cover.addEventListener("click", () => {
                window.location.href = `/user/books/${book._id}`;
            });

            container.appendChild(card);
        });

        console.log("Rendered new arrivals:", books.length);

    } catch (error) {
        console.error("New arrivals error:", error);
        container.textContent = "Unable to load new arrivals.";
    }
}

// Display only the latest books
function displayNewArrivals(books) {
    newArrivalsContainer.innerHTML = "";

    books.slice(0, 3).forEach(book => {
        const card = document.createElement("article");
        card.className = "book-card";

        const cover = document.createElement("div");
        cover.className = "book-cover";
        cover.style.cursor = "pointer";

        const img = document.createElement("img");
        img.src = book.image || "/images/book-placeholder.png";
        img.alt = book.title
            ? `${book.title} book cover`
            : "Book cover";
        img.loading = "lazy";

        img.onerror = () => {
            img.onerror = null;
            img.removeAttribute("src");
            img.alt = "Cover unavailable";
        };

        cover.appendChild(img);

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
        price.textContent =
            `₹${Number(book.price || 0).toLocaleString("en-IN")}`;

        const cartButton = document.createElement("button");
        cartButton.className = "add-cart";
        cartButton.type = "button";
        cartButton.textContent = "Add to Cart";

        cartButton.addEventListener("click", async () => {
            await addToCart(book._id);
        });

        bottom.append(price, cartButton);
        details.append(author, title, bottom);
        card.append(cover, details);

        newArrivalsContainer.appendChild(card);
    });
}

// INITIAL LOAD

loadNewArrivals();
loadCartCount();