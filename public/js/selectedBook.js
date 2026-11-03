
document.addEventListener("DOMContentLoaded", () => {

    // DOM ELEMENTS

    const bookId = document.body.dataset.bookId;
    const bookImage = document.getElementById("bookImage");
    const bookImage2 = document.getElementById("bookImage2");

    const bookTitle = document.getElementById("bookTitle");
    const bookAuthor = document.getElementById("bookAuthor");
    const bookGenre = document.getElementById("bookGenre");
    const bookPrice = document.getElementById("bookPrice");
    const bookDescription = document.getElementById("bookDescription");

    const breadcrumbGenre = document.getElementById("breadcrumbGenre");
    const breadcrumbTitle = document.getElementById("breadcrumbTitle");
    const stockNote = document.getElementById("stockNote");

    const quantityDisplay = document.getElementById("quantity");
    const decreaseBtn = document.getElementById("decreaseQty");
    const increaseBtn = document.getElementById("increaseQty");
    const addToCartBtn = document.getElementById("addToCartBtn");
    const message = document.getElementById("message");

    let selectedBook = null;
    let quantity = 1;

    // SHOW MESSAGE


    function showMessage(text, isError = false) {
        if (!message) return;

        message.textContent = text;
        message.classList.toggle("error", isError);
    }

    // DISPLAY BOOK IMAGES

    function setBookImage(img, src, alt) {
        if (!img) return;

        // Prevent a broken image from remaining visible
        img.onerror = () => {
            img.hidden = true;
            img.removeAttribute("src");
        };

        if (src && String(src).trim() !== "") {
            img.src = src;
            img.alt = alt;
            img.hidden = false;
        } else {
            img.hidden = true;
            img.removeAttribute("src");
        }
    }

    // QUANTITY CONTROLS

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
            
const frontThumb = document.getElementById("frontThumb");
const frontThumbImage = document.getElementById("frontThumbImage");

const backThumb = document.getElementById("backThumb");
const backThumbImage = document.getElementById("backThumbImage");

if (selectedBook.image) {
    bookImage.src = selectedBook.image;
    frontThumbImage.src = selectedBook.image;
    frontThumb.hidden = false;
}

if (selectedBook.image2) {
    backThumbImage.src = selectedBook.image2;
    backThumb.hidden = false;
} else {
    backThumb.hidden = true;
}

frontThumb.onclick = () => {
    if (!selectedBook.image) return;

    bookImage.src = selectedBook.image;

    frontThumb.classList.add("active");
    backThumb.classList.remove("active");
};

backThumb.onclick = () => {
    if (!selectedBook.image2) return;

    bookImage.src = selectedBook.image2;

    backThumb.classList.add("active");
    frontThumb.classList.remove("active");
};


            // Book information
            bookTitle.textContent =
                selectedBook.title || "Untitled";

            bookAuthor.textContent =
                selectedBook.author || "Unknown Author";

            bookGenre.textContent =
                selectedBook.genre || "Unknown";

            bookPrice.textContent =
                `₹${Number(selectedBook.price || 0).toFixed(2)}`;

            bookDescription.textContent =
                selectedBook.description ||
                "No description available.";

            breadcrumbGenre.textContent =
                selectedBook.genre || "Books";

            breadcrumbTitle.textContent =
                selectedBook.title || "Untitled";

           
            // FIRST COVER IMAGE

            setBookImage(
                bookImage,
                selectedBook.image,
                `${selectedBook.title || "Book"} cover`
            );

            // SECOND COVER IMAGE

            setBookImage(
                bookImage2,
                selectedBook.image2,
                `${selectedBook.title || "Book"} alternate cover`
            );

            // Debug: check whether the API sends image2
            console.log("First cover:", selectedBook.image);
            console.log("Second cover:", selectedBook.image2);

            // STOCK INFORMATION

            const stock = Number(selectedBook.stock) || 0;

            stockNote.textContent = stock > 0
                ? "✓ In Stock & Ready to Dispatch"
                : "Currently out of stock";

            addToCartBtn.disabled = stock <= 0;

            addToCartBtn.textContent = stock <= 0
                ? "Out of Stock"
                : "Add to Cart";

            quantity = 1;
            updateQuantity();

            // Load related books
            loadRelatedBooks(selectedBook);

        } catch (error) {
            console.error("Load book error:", error);

            bookTitle.textContent = "Book unavailable";
            bookDescription.textContent = error.message;
            stockNote.textContent = "";

            addToCartBtn.disabled = true;
        }
    }

    // DECREASE QUANTITY

    decreaseBtn.addEventListener("click", () => {
        if (quantity > 1) {
            quantity--;
            updateQuantity();
        }
    });

    // INCREASE QUANTITY

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
        addToCartBtn.textContent = "Adding...";

        showMessage("");

        try {
            const response = await fetch("/user/cart", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json"
                },
                credentials: "include",
                body: JSON.stringify({
                    bookId: selectedBook._id,
                    quantity
                })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || "Could not add book to cart."
                );
            }

            showMessage(
                data.message || "Book added to cart!"
            );

        } catch (error) {
            console.error("Add to cart error:", error);
            showMessage(error.message, true);

        } finally {
            const stock = Number(selectedBook?.stock || 0);

            addToCartBtn.disabled =
                !selectedBook || stock <= 0;

            addToCartBtn.textContent =
                stock <= 0 ? "Out of Stock" : "Add to Cart";
        }
    });

    // IMAGE ZOOM - BOTH COVERS

    const imageCard = document.querySelector(".image-card");

    const images = [bookImage, bookImage2].filter(Boolean);

    if (imageCard) {
        images.forEach(img => {
            img.addEventListener("mousemove", event => {
                if (img.hidden || !img.src) return;

                const rect = img.getBoundingClientRect();

                const x =
                    ((event.clientX - rect.left) / rect.width) * 100;

                const y =
                    ((event.clientY - rect.top) / rect.height) * 100;

                img.style.transformOrigin = `${x}% ${y}%`;
                img.style.transform = "scale(1.8)";
            });

            img.addEventListener("mouseleave", () => {
                img.style.transform = "scale(1)";
                img.style.transformOrigin = "center center";
            });
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
            .slice(0, 3);

        if (relatedBooks.length === 0) {
            container.textContent =
                "No similar books are available right now.";
            return;
        }

        container.replaceChildren();

        relatedBooks.forEach(book => {
            const card = document.createElement("article");
            card.className = "related-book-card";
            card.style.cursor = "pointer";

            const image = document.createElement("img");
            image.src = book.image || "/images/default-book.jpg";
            image.alt = book.title || "Book cover";

            image.onerror = function () {
                this.onerror = null;
                this.src = "/images/default-book.jpg";
            };

            const title = document.createElement("h3");
            title.textContent = book.title || "Untitled";

            const author = document.createElement("p");
            author.className = "related-author";
            author.textContent =
                book.author || "Unknown Author";

            const price = document.createElement("p");
            price.className = "related-price";
            price.textContent =
                `₹${Number(book.price || 0).toFixed(2)}`;

            card.append(image, title, author, price);

            card.addEventListener("click", () => {
                window.location.href =
                    `/user/books/${encodeURIComponent(book._id)}`;
            });

            container.appendChild(card);
        });

    } catch (error) {
        console.error("Related books error:", error);

        container.textContent =
            "Unable to load suggested books.";
    }
}