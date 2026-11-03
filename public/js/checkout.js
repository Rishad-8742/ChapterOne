
"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const checkoutForm = document.getElementById("checkoutForm");
    const checkoutItems = document.getElementById("checkoutItems");
    const checkoutSubtotal = document.getElementById("checkoutSubtotal");
    const checkoutTotal = document.getElementById("checkoutTotal");
    const checkoutMessage = document.getElementById("checkoutMessage");
    const placeOrderBtn = document.getElementById("placeOrderBtn");

    const savedAddressSelect = document.getElementById("savedAddressSelect");
    const addressLoadMessage = document.getElementById("addressLoadMessage");
    const addAddressLink = document.getElementById("addAddressLink");

    if (!checkoutForm || !placeOrderBtn) {
        console.error("Checkout form or Place Order button was not found.");
        return;
    }

    let cartData = {
        items: [],
        totalQuantity: 0,
        total: 0
    };

    let savedAddresses = [];
    let requestInProgress = false;
    let addressesLoaded = false;

    function showMessage(message, type = "error") {
        checkoutMessage.textContent = message;
        checkoutMessage.className = `message ${type}`;
    }

    function clearMessage() {
        checkoutMessage.textContent = "";
        checkoutMessage.className = "message";
    }

    function formatPrice(price) {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR"
        }).format(Number(price) || 0);
    }

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => {
            const entities = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            };

            return entities[character];
        });
    }

   async function readJsonResponse(response) {
    const text = await response.text();

    let data;

    try {
        data = JSON.parse(text);
    } catch {
        console.error("Checkout response is not JSON.");
        console.error("HTTP status:", response.status);
        console.error("Response URL:", response.url);
        console.error("Response body:", text.slice(0, 1000));

        throw new Error(
            `Server returned HTML instead of JSON (HTTP ${response.status}). Check the browser console.`
        );
    }

    if (!response.ok || data.success !== true) {
        throw new Error(data.message || "Something went wrong.");
    }

    return data;
}

    async function sendRequest(url, options = {}) {
        const headers = {
            Accept: "application/json",
            ...(options.body
                ? { "Content-Type": "application/json" }
                : {}),
            ...options.headers
        };

        const response = await fetch(url, {
            ...options,
            headers,
            credentials: "include"
        });

        return readJsonResponse(response);
    }

    function renderOrderSummary(data) {
        cartData = data;

        checkoutSubtotal.textContent = formatPrice(data.total);
        checkoutTotal.textContent = formatPrice(data.total);

        const items = Array.isArray(data.items) ? data.items : [];

        if (items.length === 0) {
            checkoutItems.replaceChildren();

            const message = document.createElement("p");
            message.textContent = "Your cart is empty.";

            const link = document.createElement("a");
            link.href = "/user/books";
            link.textContent = "Browse books";

            checkoutItems.append(message, link);
            updatePlaceOrderButton();
            return;
        }

        checkoutItems.innerHTML = items.map(item => `
            <article class="checkout-item">
                <img
                    src="${escapeHTML(item.image || "/images/no-book.png")}"
                    alt="${escapeHTML(item.title || "Book")}"
                >

                <div class="item-details">
                    <h3>${escapeHTML(item.title || "Book")}</h3>
                    <p>Qty: ${Number(item.quantity) || 1}</p>
                </div>

                <span class="item-price">
                    ${formatPrice(item.subtotal)}
                </span>
            </article>
        `).join("");

        updatePlaceOrderButton();
    }

    function updatePlaceOrderButton() {
        const hasCartItems =
            Array.isArray(cartData.items) && cartData.items.length > 0;

        const hasSelectedAddress =
            Boolean(savedAddressSelect?.value);

        placeOrderBtn.disabled =
            requestInProgress ||
            !hasCartItems ||
            !addressesLoaded ||
            savedAddresses.length === 0 ||
            !hasSelectedAddress;
    }

    async function loadSavedAddresses() {
        if (!savedAddressSelect) {
            throw new Error(
                "The saved-address dropdown is missing from checkout.ejs."
            );
        }

        savedAddressSelect.replaceChildren();

        const loadingOption = document.createElement("option");
        loadingOption.value = "";
        loadingOption.textContent = "Loading saved addresses...";
        savedAddressSelect.appendChild(loadingOption);

        try {
            const data = await sendRequest("/user/api/account");

            savedAddresses = Array.isArray(data.profile?.addresses)
                ? data.profile.addresses
                : [];

            savedAddressSelect.replaceChildren();

            if (savedAddresses.length === 0) {
                const option = document.createElement("option");
                option.value = "";
                option.textContent = "No saved addresses";
                savedAddressSelect.appendChild(option);

                addressLoadMessage.textContent =
                    "Please add an address before placing your order.";

                if (addAddressLink) {
                    addAddressLink.hidden = false;
                }

                addressesLoaded = true;
                updatePlaceOrderButton();
                return;
            }

            const placeholder = document.createElement("option");
            placeholder.value = "";
            placeholder.textContent = "Choose a delivery address";
            savedAddressSelect.appendChild(placeholder);

            savedAddresses.forEach(address => {
                const option = document.createElement("option");
                option.value = address._id;

                option.textContent =
                    `${address.label || "Address"} — ` +
                    `${address.fullName}, ${address.address}, ` +
                    `${address.city} - ${address.pincode}` +
                    (address.isDefault ? " (Default)" : "");

                savedAddressSelect.appendChild(option);
            });

            const defaultAddress = savedAddresses.find(
                address => address.isDefault
            );

            savedAddressSelect.value =
                (defaultAddress || savedAddresses[0])._id;

            addressLoadMessage.textContent = "";

            if (addAddressLink) {
                addAddressLink.hidden = true;
            }

            addressesLoaded = true;
            updatePlaceOrderButton();
        } catch (error) {
            console.error("Saved addresses error:", error);

            addressesLoaded = false;
            addressLoadMessage.textContent =
                error.message || "Unable to load saved addresses.";

            if (addAddressLink) {
                addAddressLink.hidden = false;
            }

            updatePlaceOrderButton();
        }
    }

    async function loadCheckoutCart() {
        placeOrderBtn.disabled = true;
        checkoutItems.textContent = "Loading your books...";

        try {
            const data = await sendRequest("/user/cart/data");
            renderOrderSummary(data);

            if (!data.items?.length) {
                showMessage("Your cart is empty. Add a book before checkout.");
            }
        } catch (error) {
            checkoutItems.textContent = "Unable to load your cart.";
            showMessage(error.message);
        }
    }

    savedAddressSelect?.addEventListener("change", () => {
        clearMessage();
        addressLoadMessage.textContent = "";
        updatePlaceOrderButton();
    });


async function openRazorpayCheckout(data, shippingAddress) {
    if (typeof window.Razorpay !== "function") {
        throw new Error(
            "Razorpay Checkout SDK is not loaded. Refresh the page and try again."
        );
    }

    if (!data.keyId || !data.razorpayOrderId || !data.orderId) {
        throw new Error(
            "Razorpay order details are missing from the server response."
        );
    }

    return new Promise((resolve, reject) => {
        let paymentHandled = false;

        const options = {
            key: data.keyId,
            amount: data.amount,
            currency: data.currency || "INR",
            name: "ChapterOne",
            description: "Book order payment",
            order_id: data.razorpayOrderId,

            handler: async function (response) {
                if (paymentHandled) return;
                paymentHandled = true;

                placeOrderBtn.textContent = "Verifying payment...";

                try {
                    const result = await sendRequest(
                        "/user/api/orders/razorpay/verify",
                        {
                            method: "POST",
                            body: JSON.stringify({
                                orderId: data.orderId,
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature
                            })
                        }
                    );

                    showMessage(
                        result.message || "Payment successful!",
                        "success"
                    );

                    placeOrderBtn.textContent = "Payment Successful!";

                    window.location.href =
                        result.redirectUrl || "/user/orders";

                    resolve(result);
                } catch (error) {
                    showMessage(
                        error.message ||
                        "Payment verification failed. Check your order status before trying again."
                    );

                    reject(error);
                }
            },

            modal: {
                ondismiss: function () {
                    if (!paymentHandled) {
                        showMessage("Payment was cancelled or the checkout was closed.");
                        reject(new Error("Payment window closed."));
                    }
                }
            },

            prefill: {
                name: shippingAddress.fullName,
                contact: shippingAddress.phone
            },

            theme: {
                color: "#7a2638"
            }
        };

        try {
            const razorpayCheckout = new window.Razorpay(options);

            razorpayCheckout.on("payment.failed", function (response) {
                if (paymentHandled) return;
                paymentHandled = true;

                const message =
                    response.error?.description ||
                    "Payment failed. Please try again.";

                showMessage(message);
                reject(new Error(message));
            });

            razorpayCheckout.open();
        } catch (error) {
            reject(error);
        }
    });
}

    checkoutForm.addEventListener("submit", async event => {
        event.preventDefault();

        if (requestInProgress) return;

        clearMessage();

        if (!addressesLoaded) {
            showMessage("Please wait while your saved addresses load.");
            return;
        }

        const selectedAddressId = savedAddressSelect?.value;

        if (savedAddresses.length === 0) {
            showMessage("Please add an address before placing your order.");
            if (addAddressLink) addAddressLink.hidden = false;
            return;
        }

        if (!selectedAddressId) {
            showMessage("Please select a delivery address.");
            savedAddressSelect?.focus();
            return;
        }

        const selectedAddress = savedAddresses.find(
            address => String(address._id) === String(selectedAddressId)
        );

        if (!selectedAddress) {
            showMessage("The selected address was not found.");
            return;
        }

        if (!cartData.items.length) {
            showMessage("Your cart is empty.");
            return;
        }

        const paymentMethod = checkoutForm.querySelector(
            'input[name="paymentMethod"]:checked'
        )?.value;

        if (!["COD", "RAZORPAY"].includes(paymentMethod)) {
            showMessage("Please select a supported payment method.");
            return;
        }

        const shippingAddress = {
            fullName: selectedAddress.fullName,
            phone: selectedAddress.phone,
            address: selectedAddress.address,
            city: selectedAddress.city,
            pincode: selectedAddress.pincode
        };

        requestInProgress = true;
        placeOrderBtn.disabled = true;
        placeOrderBtn.textContent = "Processing order...";

        try {
            if (paymentMethod === "COD") {
                const data = await sendRequest(
                    "/user/api/orders/cod",
                    {
                        method: "POST",
                        body: JSON.stringify({
                            shippingAddress,
                            paymentMethod: "COD"
                        })
                    }
                );

                showMessage(
                    `Order placed successfully! Order ID: ${data.orderId}`,
                    "success"
                );

                placeOrderBtn.textContent = "Order Placed Successfully!";

                window.setTimeout(() => {
                    window.location.href =
                        data.redirectUrl || "/user/orders";
                }, 1500);

            } else if (paymentMethod === "RAZORPAY") {
                const data = await sendRequest(
                    "/user/api/orders/razorpay",
                    {
                        method: "POST",
                        body: JSON.stringify({ shippingAddress })
                    }
                );

                if (typeof openRazorpayCheckout !== "function") {
                    throw new Error(
                        "Razorpay checkout function is missing."
                    );
                }

                await openRazorpayCheckout(data, shippingAddress);
            }
        } catch (error) {
            showMessage(
                error.message || "Unable to process your order."
            );
        } finally {
            requestInProgress = false;

            if (
                !placeOrderBtn.textContent.includes("Successfully!")
            ) {
                placeOrderBtn.textContent = "Place Order";
            }

            updatePlaceOrderButton();
        }
    });


    loadSavedAddresses();
    loadCheckoutCart();
});
