"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const checkoutForm = document.getElementById("checkoutForm");
    const checkoutItems = document.getElementById("checkoutItems");
    const checkoutItemCount = document.getElementById("checkoutItemCount");
    const checkoutSubtotal = document.getElementById("checkoutSubtotal");
    const checkoutTotal = document.getElementById("checkoutTotal");
    const checkoutMessage = document.getElementById("checkoutMessage");
    const placeOrderBtn = document.getElementById("placeOrderBtn");

    // The select stays in the page as the single source of truth for the
    // chosen address; the radio cards below it are what the customer sees.
    const savedAddressSelect = document.getElementById("savedAddressSelect");
    const addressOptions = document.getElementById("addressOptions");
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
    let orderCompleted = false;


    // =====================================
    // HELPERS
    // =====================================

    function showMessage(message, type = "error") {
        checkoutMessage.textContent = message;
        checkoutMessage.className = `message ${type}`;

        // The message sits next to the button; make sure it is seen.
        if (message && type === "error") {
            checkoutMessage.scrollIntoView({
                behavior: "smooth",
                block: "nearest"
            });
        }
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

    function createElement(tag, className, text) {
        const node = document.createElement(tag);

        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;

        return node;
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


    // =====================================
    // PLACE ORDER BUTTON
    // =====================================

    function getPaymentMethod() {
        return checkoutForm.querySelector(
            'input[name="paymentMethod"]:checked'
        )?.value;
    }

    // The idle label shows what the customer is about to pay.
    function getIdleLabel() {
        const hasItems =
            Array.isArray(cartData.items) && cartData.items.length > 0;

        if (!hasItems) return "Place order";

        const amount = formatPrice(cartData.total);

        return getPaymentMethod() === "RAZORPAY"
            ? `Pay ${amount}`
            : `Place order · ${amount}`;
    }

    function setButtonLabel(text) {
        placeOrderBtn.textContent = text;
    }

    function updatePlaceOrderButton() {
        const hasCartItems =
            Array.isArray(cartData.items) && cartData.items.length > 0;

        const hasSelectedAddress =
            Boolean(savedAddressSelect?.value);

        placeOrderBtn.disabled =
            requestInProgress ||
            orderCompleted ||
            !hasCartItems ||
            !addressesLoaded ||
            savedAddresses.length === 0 ||
            !hasSelectedAddress;

        if (!requestInProgress && !orderCompleted) {
            setButtonLabel(getIdleLabel());
        }
    }


    // =====================================
    // ORDER SUMMARY
    // =====================================

    function renderOrderSummary(data) {
        cartData = data;

        checkoutSubtotal.textContent = formatPrice(data.total);
        checkoutTotal.textContent = formatPrice(data.total);

        const items = Array.isArray(data.items) ? data.items : [];

        const itemCount = items.reduce(
            (sum, item) => sum + (Number(item.quantity) || 0),
            0
        );

        if (checkoutItemCount) {
            checkoutItemCount.textContent = itemCount
                ? `${itemCount} ${itemCount === 1 ? "item" : "items"}`
                : "";
        }

        if (items.length === 0) {
            const empty = createElement("div", "checkout-empty");

            const link = createElement("a", "", "Browse books");
            link.href = "/user/books";

            empty.append(
                createElement("p", "", "Your cart is empty."),
                link
            );

            checkoutItems.replaceChildren(empty);
            updatePlaceOrderButton();
            return;
        }

        checkoutItems.innerHTML = items.map(item => `
            <article class="checkout-item">
                <img
                    src="${escapeHTML(item.image || "/images/no-book.png")}"
                    alt="${escapeHTML(item.title || "Book")}"
                    loading="lazy"
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

    async function loadCheckoutCart() {
        placeOrderBtn.disabled = true;

        checkoutItems.replaceChildren(
            createElement("p", "checkout-loading", "Loading your books...")
        );

        try {
            const data = await sendRequest("/user/cart/data");
            renderOrderSummary(data);

            if (!data.items?.length) {
                showMessage("Your cart is empty. Add a book before checkout.");
            }
        } catch (error) {
            checkoutItems.replaceChildren(
                createElement(
                    "p",
                    "checkout-loading",
                    "Unable to load your cart."
                )
            );

            showMessage(error.message);
        }
    }


    // =====================================
    // SAVED ADDRESSES
    // =====================================

    function renderAddressOptions() {
        addressOptions.replaceChildren();

        savedAddresses.forEach(address => {
            const id = String(address._id);

            const option = createElement("label", "address-option");

            const radio = document.createElement("input");
            radio.type = "radio";
            radio.name = "deliveryAddress";
            radio.value = id;
            radio.checked = savedAddressSelect.value === id;

            radio.addEventListener("change", () => {
                savedAddressSelect.value = id;

                clearMessage();
                addressLoadMessage.textContent = "";
                updatePlaceOrderButton();
            });

            const body = createElement("div", "address-option-body");

            const head = createElement("div", "address-option-head");
            head.append(
                createElement(
                    "span",
                    "address-option-label",
                    address.label || "Address"
                )
            );

            if (address.isDefault) {
                head.append(createElement("span", "address-badge", "Default"));
            }

            const nameLine = [address.fullName, address.phone]
                .filter(Boolean)
                .join(" · ");

            const textLine =
                `${address.address || ""}, ` +
                `${address.city || ""} - ${address.pincode || ""}`;

            body.append(
                head,
                createElement("p", "address-option-name", nameLine),
                createElement("p", "address-option-text", textLine)
            );

            option.append(radio, body);
            addressOptions.append(option);
        });
    }

    async function loadSavedAddresses() {
        if (!savedAddressSelect || !addressOptions) {
            throw new Error(
                "The saved-address elements are missing from checkout.ejs."
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

                addressOptions.replaceChildren(
                    createElement(
                        "p",
                        "address-empty",
                        "You haven't saved a delivery address yet."
                    )
                );

                addressLoadMessage.textContent =
                    "Please add an address before placing your order.";

                if (addAddressLink) {
                    addAddressLink.textContent = "+ Add an address";
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

            renderAddressOptions();

            addressLoadMessage.textContent = "";

            if (addAddressLink) {
                addAddressLink.textContent = "Manage addresses";
            }

            addressesLoaded = true;
            updatePlaceOrderButton();
        } catch (error) {
            console.error("Saved addresses error:", error);

            addressesLoaded = false;

            addressOptions.replaceChildren(
                createElement(
                    "p",
                    "address-empty",
                    "Unable to load your saved addresses."
                )
            );

            addressLoadMessage.textContent =
                error.message || "Unable to load saved addresses.";

            updatePlaceOrderButton();
        }
    }

    // Changing the payment method updates the button label.
    checkoutForm.addEventListener("change", event => {
        if (event.target.name === "paymentMethod") {
            clearMessage();
            updatePlaceOrderButton();
        }
    });


    // =====================================
    // RAZORPAY
    // =====================================

    // All user-facing error text is shown once, by the submit handler,
    // so every rejection here only needs a clear message.
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

                    setButtonLabel("Verifying payment...");

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

                        orderCompleted = true;
                        setButtonLabel("Payment successful ✓");

                        window.location.href =
                            result.redirectUrl || "/user/orders";

                        resolve(result);
                    } catch (error) {
                        reject(
                            new Error(
                                error.message ||
                                "Payment verification failed. Check your order status before trying again."
                            )
                        );
                    }
                },

                modal: {
                    ondismiss: function () {
                        if (!paymentHandled) {
                            reject(
                                new Error(
                                    "Payment was cancelled. Your cart is unchanged, so you can try again."
                                )
                            );
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

                    reject(
                        new Error(
                            response.error?.description ||
                            "Payment failed. Please try again."
                        )
                    );
                });

                razorpayCheckout.open();
            } catch (error) {
                reject(error);
            }
        });
    }


    // =====================================
    // PLACE ORDER
    // =====================================

    checkoutForm.addEventListener("submit", async event => {
        event.preventDefault();

        if (requestInProgress || orderCompleted) return;

        clearMessage();

        if (!addressesLoaded) {
            showMessage("Please wait while your saved addresses load.");
            return;
        }

        const selectedAddressId = savedAddressSelect?.value;

        if (savedAddresses.length === 0) {
            showMessage("Please add an address before placing your order.");
            return;
        }

        if (!selectedAddressId) {
            showMessage("Please select a delivery address.");
            addressOptions?.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
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

        const paymentMethod = getPaymentMethod();

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
        setButtonLabel("Processing order...");

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

                orderCompleted = true;
                setButtonLabel("Order placed ✓");

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

                await openRazorpayCheckout(data, shippingAddress);
            }
        } catch (error) {
            showMessage(
                error.message || "Unable to process your order."
            );
        } finally {
            requestInProgress = false;

            // After a completed order the button stays locked until the
            // redirect, so a second click can never create a second order.
            updatePlaceOrderButton();
        }
    });


    loadSavedAddresses();
    loadCheckoutCart();
});