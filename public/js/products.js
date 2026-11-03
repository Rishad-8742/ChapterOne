// DOM ELEMENTS

const productsBody = document.getElementById("productsBody");
const searchInput = document.getElementById("searchInput");
const stockFilter = document.getElementById("stockFilter");

const totalInfo = document.getElementById("totalInfo");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const pageInfo = document.getElementById("pageInfo");

const productModal = document.getElementById("productModal");
const productForm = document.getElementById("productForm");
const productId = document.getElementById("productId");

const titleInput = document.getElementById("title");
const authorInput = document.getElementById("author");
const languageInput = document.getElementById("language");
const genreInput = document.getElementById("genre");
const priceInput = document.getElementById("price");
const stockInput = document.getElementById("stock");
const descriptionInput = document.getElementById("description");

const modalTitle = document.getElementById("modalTitle");
const formError = document.getElementById("formError");
const cancelBtn = document.getElementById("cancelBtn");
const toast = document.getElementById("toast");

const imageInput = document.getElementById("image");
const image2Input = document.getElementById("image2");

const imagePreview = document.getElementById("imagePreview");
const image2Preview = document.getElementById("image2Preview");

let allBooks = [];
let currentPage = 1;

const booksPerPage = 10;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

// API HELPER


async function readJsonResponse(response) {
    const data = await response.json();

    if (!response.ok || data.success === false) {
        throw new Error(
            data.message || "The request failed"
        );
    }

    return data;
}


// IMAGE PREVIEWS

function showImagePreview(input, preview) {
    const file = input.files?.[0];

    if (!file) {
        return;
    }

    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    if (!allowedTypes.includes(file.type)) {
        input.value = "";

        showFormError(
            "Choose a JPG, PNG, or WEBP image."
        );

        return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
        input.value = "";

        showFormError(
            "Each image must be 5 MB or smaller."
        );

        return;
    }

    clearFormError();

    const reader = new FileReader();

    reader.onload = () => {
        preview.src = reader.result;
        preview.hidden = false;
    };

    reader.onerror = () => {
        showFormError("Could not read the selected image.");
    };

    reader.readAsDataURL(file);
}

imageInput.addEventListener("change", () => {
    showImagePreview(imageInput, imagePreview);
});

image2Input.addEventListener("change", () => {
    showImagePreview(image2Input, image2Preview);
});


// CONVERT IMAGE TO BASE64 DATA URL


function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            resolve(null);
            return;
        }

        const reader = new FileReader();

        reader.onload = () => {
            resolve(reader.result);
        };

        reader.onerror = () => {
            reject(new Error("Failed to read image."));
        };

        reader.readAsDataURL(file);
    });
}

// LOAD PRODUCTS

async function loadProducts() {
    productsBody.innerHTML = `
        <tr>
            <td colspan="6" class="empty">
                Loading books...
            </td>
        </tr>
    `;

    try {
        const response = await fetch("/admin/products/api", {
            method: "GET",
            headers: {
                Accept: "application/json"
            },
            credentials: "include"
        });

        const data = await readJsonResponse(response);

        allBooks = data.books || [];

        // Do not reset currentPage here.
        // This preserves the current page after editing a book.

        renderProducts();

    } catch (error) {
        console.error("Load products error:", error);

        productsBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty">
                    Failed to load products.
                    Please refresh and try again.
                </td>
            </tr>
        `;

        showToast(error.message, "error");
    }
}


// RENDER PRODUCTS

function renderProducts() {
    const searchText = searchInput.value
        .trim()
        .toLowerCase();

    const stockValue = stockFilter.value;

    const filteredBooks = allBooks.filter(book => {
        const title = String(book.title || "").toLowerCase();
        const author = String(book.author || "").toLowerCase();

        const matchesSearch =
            title.includes(searchText) ||
            author.includes(searchText);

        const stock = Number(book.stock || 0);

        const matchesStock =
            stockValue === "all" ||
            (stockValue === "in" && stock > 0) ||
            (stockValue === "out" && stock === 0);

        return matchesSearch && matchesStock;
    });

    const totalBooks = filteredBooks.length;

    const totalPages = Math.max(
        Math.ceil(totalBooks / booksPerPage),
        1
    );

    if (currentPage > totalPages) {
        currentPage = totalPages;
    }

    const startIndex = (currentPage - 1) * booksPerPage;

    const booksToShow = filteredBooks.slice(
        startIndex,
        startIndex + booksPerPage
    );

    productsBody.innerHTML = "";

    if (booksToShow.length === 0) {
        productsBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty">
                    No books found.
                </td>
            </tr>
        `;
    }

    booksToShow.forEach(book => {
        const row = document.createElement("tr");
        const stock = Number(book.stock || 0);

        const titleCell = document.createElement("td");
        titleCell.textContent = book.title || "-";

        const languageCell = document.createElement("td");
        languageCell.textContent = book.language || "-";

        const genreCell = document.createElement("td");
        genreCell.textContent = book.genre || "-";

        const priceCell = document.createElement("td");
        priceCell.textContent =
            `₹${Number(book.price || 0).toFixed(2)}`;

        const stockCell = document.createElement("td");
        stockCell.textContent = String(stock);

        const actionCell = document.createElement("td");
        const actions = document.createElement("div");

        actions.className = "actions";

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "btn-sm";
        editButton.textContent = "Edit";
        editButton.addEventListener("click", () => {
            editBook(book._id);
        });

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "danger btn-sm";
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", () => {
            deleteBook(book._id);
        });

        actions.append(editButton, deleteButton);
        actionCell.appendChild(actions);

        row.append(
            titleCell,
            languageCell,
            genreCell,
            priceCell,
            stockCell,
            actionCell
        );

        productsBody.appendChild(row);
    });

    totalInfo.textContent =
        `${totalBooks} ${totalBooks === 1 ? "book" : "books"}`;

    pageInfo.textContent =
        `Page ${currentPage} of ${totalPages}`;

    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;
}

// SEARCH AND STOCK FILTER

searchInput.addEventListener("input", () => {
    currentPage = 1;
    renderProducts();
});

stockFilter.addEventListener("change", () => {
    currentPage = 1;
    renderProducts();
});

// PAGINATION

prevBtn.addEventListener("click", () => {
    if (currentPage > 1) {
        currentPage--;
        renderProducts();
    }
});

nextBtn.addEventListener("click", () => {
    currentPage++;
    renderProducts();
});

// OPEN MODAL

function openModal() {
    productModal.style.display = "flex";
    document.body.classList.add("modal-open");
}

// EDIT BOOK

async function editBook(id) {
    try {
        const response = await fetch(
            `/admin/products/${encodeURIComponent(id)}`,
            {
                method: "GET",
                headers: {
                    Accept: "application/json"
                },
                credentials: "include"
            }
        );

        const data = await readJsonResponse(response);
        const book = data.book;

        if (!book) {
            throw new Error("Book details were not returned.");
        }

        productForm.reset();

        productId.value = book._id;
        titleInput.value = book.title || "";
        authorInput.value = book.author || "";
        languageInput.value = book.language || "";
        genreInput.value = book.genre || "";
        priceInput.value = book.price ?? "";
        stockInput.value = book.stock ?? 0;
        descriptionInput.value = book.description || "";

        // Never call .click() on file inputs here.
        imageInput.value = "";
        image2Input.value = "";

        imagePreview.onload = null;
        imagePreview.onerror = () => {
            imagePreview.hidden = true;
        };

        image2Preview.onload = null;
        image2Preview.onerror = () => {
            image2Preview.hidden = true;
        };

        if (book.image) {
            imagePreview.src = book.image;
            imagePreview.hidden = false;
        } else {
            imagePreview.removeAttribute("src");
            imagePreview.hidden = true;
        }

        if (book.image2) {
            image2Preview.src = book.image2;
            image2Preview.hidden = false;
        } else {
            image2Preview.removeAttribute("src");
            image2Preview.hidden = true;
        }

        modalTitle.textContent = "Edit Book";
        clearFormError();

        openModal();
    } catch (error) {
        console.error("Edit book error:", error);
        showToast(error.message, "error");
    }
}

// DELETE BOOK

async function deleteBook(id) {
    const confirmed = confirm(
        "Are you sure you want to delete this book?"
    );

    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch(
            `/admin/products/${encodeURIComponent(id)}`,
            {
                method: "DELETE",
                headers: {
                    Accept: "application/json"
                },
                credentials: "include"
            }
        );

        const data = await readJsonResponse(response);

        showToast(
            data.message || "Book deleted successfully",
            "success"
        );

        await loadProducts();
    } catch (error) {
        console.error("Delete book error:", error);
        showToast(error.message, "error");
    }
}

// FORM ERROR HELPERS

function showFormError(message) {
    formError.textContent = message;
}

function clearFormError() {
    formError.textContent = "";
}

// VALIDATE FORM

function validateBookData(bookData) {
    if (!bookData.title) {
        return "Title is required.";
    }

    if (!bookData.author) {
        return "Author is required.";
    }

    if (!bookData.language) {
        return "Language is required.";
    }

    if (!bookData.genre) {
        return "Genre is required.";
    }

    if (
        !Number.isFinite(bookData.price) ||
        bookData.price < 0
    ) {
        return "Enter a valid, non-negative price.";
    }

    if (
        !Number.isInteger(bookData.stock) ||
        bookData.stock < 0
    ) {
        return "Stock must be a non-negative integer.";
    }

    return null;
}

// UPDATE BOOK USING JSON + BASE64

productForm.addEventListener("submit", async event => {
    event.preventDefault();

    clearFormError();

    const id = productId.value;

    if (!id) {
        showFormError("Invalid book ID.");
        return;
    }

    const bookData = {
        title: titleInput.value.trim(),
        author: authorInput.value.trim(),
        language: languageInput.value.trim(),
        genre: genreInput.value.trim(),
        price: Number(priceInput.value),
        stock: Number(stockInput.value),
        description: descriptionInput.value.trim()
    };

    const validationError = validateBookData(bookData);

    if (validationError) {
        showFormError(validationError);
        return;
    }

    const saveButton = document.getElementById("saveBtn");

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    try {
        // Convert only newly selected files.
        // null means keep the existing image.
        const imageBase64 = await fileToBase64(
            imageInput.files[0]
        );

        const image2Base64 = await fileToBase64(
            image2Input.files[0]
        );

        const response = await fetch(
            `/admin/products/${encodeURIComponent(id)}`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json"
                },
                credentials: "include",
                body: JSON.stringify({
                    ...bookData,
                    imageBase64,
                    image2Base64
                })
            }
        );

        const data = await readJsonResponse(response);

        closeModal();

        showToast(
            data.message || "Book updated successfully",
            "success"
        );

        await loadProducts();
    } catch (error) {
        console.error("Update book error:", error);
        showFormError(error.message || "Failed to update book.");
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = "Save";
    }
});

// CLOSE MODAL

cancelBtn.addEventListener("click", closeModal);

function closeModal() {
    productModal.style.display = "none";
    document.body.classList.remove("modal-open");

    productForm.reset();

    productId.value = "";
    clearFormError();

    imagePreview.removeAttribute("src");
    imagePreview.hidden = true;

    image2Preview.removeAttribute("src");
    image2Preview.hidden = true;

    modalTitle.textContent = "Add Book";
}

// TOAST

function showToast(message, type = "success") {
    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
        toast.className = "toast";
    }, 3000);
}

// LOAD WHEN PAGE OPENS

loadProducts();
