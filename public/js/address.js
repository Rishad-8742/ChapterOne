
"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const list = document.getElementById("addressList");
    const form = document.getElementById("addressForm");
    const toggleButton = document.getElementById("toggleAddressForm");
    const cancelButton = document.getElementById("cancelAddressForm");
    const title = document.getElementById("addressFormTitle");
    const saveButton = document.getElementById("saveAddressBtn");

    if (!list || !form) return;

    const fields = {
        id: document.getElementById("addressId"),
        label: document.getElementById("addressLabel"),
        fullName: document.getElementById("addressFullName"),
        phone: document.getElementById("addressPhone"),
        city: document.getElementById("addressCity"),
        pincode: document.getElementById("addressPincode"),
        address: document.getElementById("addressText"),
        isDefault: document.getElementById("addressDefault")
    };

    let addresses = [];

    async function apiRequest(url, options = {}) {
        const response = await fetch(url, {
            credentials: "include",
            ...options,
            headers: {
                Accept: "application/json",
                ...(options.body
                    ? { "Content-Type": "application/json" }
                    : {}),
                ...options.headers
            }
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || data.success === false) {
            throw new Error(data.message || "Request failed.");
        }

        return data;
    }

    function element(tag, className, text) {
        const node = document.createElement(tag);

        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;

        return node;
    }

    function button(text, action) {
        const node = element("button", "secondary-button", text);
        node.type = "button";
        node.addEventListener("click", action);
        return node;
    }

    async function loadAddresses() {
        list.textContent = "Loading your addresses...";

        try {
            const data = await apiRequest("/user/api/account");
            addresses = data.profile?.addresses || [];
            renderAddresses();
        } catch (error) {
            console.error("Load addresses error:", error);
            list.replaceChildren(
                element("p", "empty-state", error.message)
            );
        }
    }

    function renderAddresses() {
        list.replaceChildren();

        if (!addresses.length) {
            list.append(
                element("p", "empty-state", "You haven't saved an address yet.")
            );
            return;
        }

        addresses.forEach((address) => {
            const card = element("article", "address-card");

            const heading = element(
                "h3",
                "",
                `${address.label || "Address"}${address.isDefault ? " — Default" : ""}`
            );

            const details = element(
                "p",
                "address-details",
                [
                    address.fullName,
                    address.phone,
                    address.address,
                    `${address.city || ""} ${address.pincode || ""}`.trim()
                ].filter(Boolean).join("\n")
            );

            details.style.whiteSpace = "pre-line";
            card.append(heading, details);

            const actions = element("div", "address-actions");

            actions.append(
                button("Edit", () => editAddress(address)),
                button("Delete", () => deleteAddress(address._id))
            );

            if (!address.isDefault) {
                actions.append(
                    button("Set as default", () => setDefault(address._id))
                );
            }

            card.append(actions);
            list.append(card);
        });
    }

    function resetForm() {
        form.reset();
        fields.id.value = "";
        fields.label.value = "Home";

        if (title) title.textContent = "Add Delivery Address";
        if (saveButton) saveButton.textContent = "Save Address";
    }

    function openForm() {
        form.hidden = false;
        form.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function editAddress(address) {
        fields.id.value = address._id || "";
        fields.label.value = address.label || "Home";
        fields.fullName.value = address.fullName || "";
        fields.phone.value = address.phone || "";
        fields.city.value = address.city || "";
        fields.pincode.value = address.pincode || "";
        fields.address.value = address.address || "";
        fields.isDefault.checked = Boolean(address.isDefault);

        if (title) title.textContent = "Edit Delivery Address";
        if (saveButton) saveButton.textContent = "Update Address";

        openForm();
    }

    toggleButton?.addEventListener("click", () => {
        resetForm();
        openForm();
    });

    cancelButton?.addEventListener("click", () => {
        resetForm();
        form.hidden = true;
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const payload = {
            label: fields.label.value,
            fullName: fields.fullName.value.trim(),
            phone: fields.phone.value.trim(),
            city: fields.city.value.trim(),
            pincode: fields.pincode.value.trim(),
            address: fields.address.value.trim(),
            isDefault: fields.isDefault.checked
        };

        if (payload.fullName.length < 2 || payload.fullName.length > 60) {
            alert("Recipient name must contain 2–60 characters.");
            return;
        }

        if (!/^[6-9]\d{9}$/.test(payload.phone)) {
            alert("Enter a valid 10-digit Indian phone number.");
            return;
        }

        if (!/^\d{6}$/.test(payload.pincode)) {
            alert("Enter a valid 6-digit PIN code.");
            return;
        }

        const id = fields.id.value;
        const url = id
            ? `/user/api/account/addresses/${encodeURIComponent(id)}`
            : "/user/api/account/addresses";

        saveButton.disabled = true;
        saveButton.textContent = "Saving...";

        try {
            await apiRequest(url, {
                method: id ? "PATCH" : "POST",
                body: JSON.stringify(payload)
            });

            resetForm();
            form.hidden = true;
            await loadAddresses();
        } catch (error) {
            console.error("Save address error:", error);
            alert(error.message || "Unable to save address.");
        } finally {
            saveButton.disabled = false;
            saveButton.textContent = fields.id.value
                ? "Update Address"
                : "Save Address";
        }
    });

    async function deleteAddress(id) {
        if (!id || !confirm("Delete this address?")) return;

        try {
            await apiRequest(
                `/user/api/account/addresses/${encodeURIComponent(id)}`,
                { method: "DELETE" }
            );

            await loadAddresses();
        } catch (error) {
            alert(error.message || "Unable to delete address.");
        }
    }

    async function setDefault(id) {
        try {
            await apiRequest(
                `/user/api/account/addresses/${encodeURIComponent(id)}/default`,
                { method: "PATCH" }
            );

            await loadAddresses();
        } catch (error) {
            alert(error.message || "Unable to set default address.");
        }
    }

    loadAddresses();
});
