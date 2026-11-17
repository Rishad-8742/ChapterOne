
"use strict";

document.addEventListener("DOMContentLoaded", () => {

    const cartCount = document.getElementById("cartCount");

    async function updateCartCount() {

        if (!cartCount) return;

        try {
            const response = await fetch("/user/cart/count", {
                method: "GET",
                credentials: "include",
                headers: {
                    Accept: "application/json"
                }
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || "Failed to load cart count");
            }

            cartCount.textContent = data.count;

        } catch (error) {
            console.error("Navbar cart count error:", error);
        }
    }

    updateCartCount();

    window.updateCartCount = updateCartCount;

});
