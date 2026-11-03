
document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById(
        "newArrivalsContainer"
    );

    if (!container) return;

    loadNewArrivals();

    async function loadNewArrivals() {
        try {
            const response = await fetch(
                "/user/api/books/new-arrivals",
                {
                    method: "GET",
                    credentials: "include",
                    headers: {
                        Accept: "application/json"
                    }
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || "Failed to load books"
                );
            }

            const books = data.books || [];

            if (books.length === 0) {
                container.innerHTML = `
                    <p class="empty-message">
                        New books will be arriving soon.
                    </p>
                `;
                return;
            }

            container.innerHTML = books.map(book => `
                <article class="book-card">
                    <a
                        href="/user/books/${encodeURIComponent(book._id)}"
                        class="book-image-link"
                        aria-label="View ${escapeHTML(book.title)}"
                    >
                        <div class="book-image">
                            <img
                                src="${escapeHTML(book.image || "")}"
                                alt="${escapeHTML(book.title)} cover"
                                loading="lazy"
                                onerror="this.style.visibility='hidden'"
                            >
                        </div>
                    </a>

                    <div class="book-info">
                        <p class="book-author">
                            ${escapeHTML(book.author || "Unknown author")}
                        </p>

                        <h3>${escapeHTML(book.title)}</h3>

                        <div class="book-card-footer">
                            <span class="book-price">
                                ₹${Number(book.price || 0).toFixed(0)}
                            </span>

                            <a
                                class="book-details-link"
                                href="/user/books/${encodeURIComponent(book._id)}"
                            >
                                View Book
                            </a>
                        </div>
                    </div>
                </article>
            `).join("");

        } catch (error) {
            console.error("New arrivals:", error);

            container.innerHTML = `
                <p class="empty-message">
                    Unable to load new arrivals. Please try again later.
                </p>
            `;
        }
    }

    function escapeHTML(value) {
        return String(value).replace(/[&<>"']/g, character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]);
    }
});
