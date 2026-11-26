
"use strict";

document.addEventListener("DOMContentLoaded", () => {

    // ELEMENTS
    const couponForm = document.getElementById("couponForm");
    const couponFormSection = document.getElementById("couponFormSection");
    const couponTableBody = document.getElementById("couponTableBody");

    const openCouponForm = document.getElementById("openCouponForm");
    const closeCouponForm = document.getElementById("closeCouponForm");
    const cancelCouponForm = document.getElementById("cancelCouponForm");

    const couponSearch = document.getElementById("couponSearch");

    const couponId = document.getElementById("couponId");
    const formTitle = document.getElementById("formTitle");
    const saveCouponBtn = document.getElementById("saveCouponBtn");

    const discountType = document.getElementById("discountType");
    const discountValue = document.getElementById("discountValue");
    const discountValueHelp = document.getElementById("discountValueHelp");

    const maxDiscount = document.getElementById("maxDiscount");
    const maxDiscountGroup = document.getElementById("maxDiscountGroup");

    const API_URL = "/admin/coupons/api";

    let coupons = [];

    // FETCH HELPER
    async function apiRequest(url, options = {}) {

        const response = await fetch(url, {
            credentials: "include",
            ...options,
            headers: {
                "Accept": "application/json",
                ...(options.body ? {
                    "Content-Type": "application/json"
                } : {}),
                ...options.headers
            }
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || data.success === false) {
            throw new Error(data.message || "Something went wrong.");
        }

        return data;
    }

    // SHOW/HIDE MAXIMUM DISCOUNT
    function updateDiscountFields() {

        const isPercentage = discountType.value === "percentage";

        maxDiscountGroup.hidden = !isPercentage;
        maxDiscount.required = false;

        if (!isPercentage) {
            maxDiscount.value = "";
        }

        discountValue.max = isPercentage ? "100" : "";

        discountValueHelp.textContent = isPercentage
            ? "Enter a percentage between 0 and 100."
            : "Enter the fixed discount amount in rupees.";
    }

    discountType.addEventListener("change", updateDiscountFields);

    // LOAD COUPONS
    async function loadCoupons() {

        try {

            couponTableBody.innerHTML = `
                <tr>
                    <td colspan="7">Loading coupons...</td>
                </tr>
            `;

            const data = await apiRequest(API_URL);

            coupons = Array.isArray(data)
                ? data
                : data.coupons || [];

            renderCoupons(coupons);

        } catch (error) {

            console.error("Load coupons error:", error);

            couponTableBody.innerHTML = `
                <tr>
                    <td colspan="7">${escapeHTML(error.message)}</td>
                </tr>
            `;
        }
    }

    // RENDER COUPONS
    function renderCoupons(list) {

        if (!list.length) {

            couponTableBody.innerHTML = `
                <tr>
                    <td colspan="7">No coupons found.</td>
                </tr>
            `;

            return;
        }

        couponTableBody.innerHTML = list.map(coupon => {

            const now = new Date();

            const expiredByDate = coupon.expiryDate &&
                new Date(coupon.expiryDate) <= now;

            const expiredByUsage =
                coupon.usedCount >= coupon.usageLimit;

            const notStarted = coupon.startDate &&
                new Date(coupon.startDate) > now;

            const status = !coupon.isActive
                ? "Inactive"
                : expiredByDate || expiredByUsage
                    ? "Expired"
                    : notStarted
                        ? "Scheduled"
                        : "Active";

            const statusClass = status.toLowerCase();

            let discount = coupon.discountType === "percentage"
                ? `${coupon.discountValue}%`
                : `₹${coupon.discountValue}`;

            if (
                coupon.discountType === "percentage" &&
                coupon.maxDiscount != null
            ) {
                discount += ` (Up to ₹${coupon.maxDiscount})`;
            }

            const usage = `${coupon.usedCount || 0} / ${coupon.usageLimit}`;

            return `
                <tr>
                    <td><strong>${escapeHTML(coupon.code)}</strong></td>

                    <td>${escapeHTML(discount)}</td>

                    <td>₹${Number(coupon.minPurchase || 0).toFixed(2)}</td>

                    <td>${escapeHTML(usage)}</td>

                    <td>${formatDate(coupon.expiryDate)}</td>

                    <td>
                        <span class="status-badge status-${statusClass}">
                            ${status}
                        </span>
                    </td>

                    <td>
                        <button
                            class="action-btn edit-btn"
                            data-action="edit"
                            data-id="${escapeHTML(coupon._id)}">
                            Edit
                        </button>

                        <button
                            class="action-btn toggle-btn"
                            data-action="toggle"
                            data-id="${escapeHTML(coupon._id)}">
                            ${coupon.isActive ? "Disable" : "Enable"}
                        </button>

                        <button
                            class="action-btn delete-btn"
                            data-action="delete"
                            data-id="${escapeHTML(coupon._id)}">
                            Delete
                        </button>
                    </td>
                </tr>
            `;

        }).join("");
    }

    // ESCAPE HTML
    function escapeHTML(value) {

        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        })[char]);
    }

    // FORMAT DATE
    function formatDate(date) {

        if (!date) return "-";

        const parsedDate = new Date(date);

        if (Number.isNaN(parsedDate.getTime())) return "-";

        return parsedDate.toLocaleDateString("en-IN");
    }

    // OPEN FORM
    function showForm() {

        couponFormSection.hidden = false;

        couponFormSection.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    // RESET FORM
    function resetForm() {

        couponForm.reset();

        couponId.value = "";

        formTitle.textContent = "Create New Coupon";

        saveCouponBtn.textContent = "Save Coupon";

        updateDiscountFields();

        couponFormSection.hidden = true;
    }

    openCouponForm.addEventListener("click", () => {

        resetForm();

        showForm();
    });

    closeCouponForm.addEventListener("click", resetForm);

    cancelCouponForm.addEventListener("click", resetForm);

    // CREATE / UPDATE COUPON
    couponForm.addEventListener("submit", async (event) => {

        event.preventDefault();

        const id = couponId.value;

        const body = {

            code: document.getElementById("code").value.trim(),

            discountType: discountType.value,

            discountValue: Number(discountValue.value),

            minPurchase: Number(
                document.getElementById("minPurchase").value || 0
            ),

            maxDiscount:
                discountType.value === "percentage" &&
                maxDiscount.value !== ""
                    ? Number(maxDiscount.value)
                    : null,

            usageLimit: Number(
                document.getElementById("usageLimit").value
            ),

            startDate: document.getElementById("startDate").value,

            expiryDate: document.getElementById("expiryDate").value,

            isActive: document.getElementById("isActive").value === "true"
        };

        try {

            saveCouponBtn.disabled = true;
            saveCouponBtn.textContent = "Saving...";

            const url = id
                ? `${API_URL}/${encodeURIComponent(id)}`
                : API_URL;

            const method = id ? "PUT" : "POST";

            const data = await apiRequest(url, {
                method,
                body: JSON.stringify(body)
            });

            alert(data.message || "Coupon saved successfully.");

            resetForm();

            await loadCoupons();

        } catch (error) {

            console.error("Save coupon error:", error);

            alert(error.message);

        } finally {

            saveCouponBtn.disabled = false;

            saveCouponBtn.textContent = couponId.value
                ? "Update Coupon"
                : "Save Coupon";
        }
    });

    // EDIT / TOGGLE / DELETE
    couponTableBody.addEventListener("click", async (event) => {

        const button = event.target.closest("button[data-action]");

        if (!button) return;

        const id = button.dataset.id;
        const action = button.dataset.action;

        const coupon = coupons.find(item => item._id === id);

        if (!coupon) return;

        // EDIT
        if (action === "edit") {

            couponId.value = coupon._id;

            document.getElementById("code").value = coupon.code || "";

            discountType.value = coupon.discountType || "percentage";

            discountValue.value = coupon.discountValue ?? "";

            document.getElementById("minPurchase").value =
                coupon.minPurchase ?? 0;

            maxDiscount.value = coupon.maxDiscount ?? "";

            document.getElementById("usageLimit").value =
                coupon.usageLimit ?? "";

            document.getElementById("startDate").value =
                toDateTimeLocal(coupon.startDate);

            document.getElementById("expiryDate").value =
                toDateTimeLocal(coupon.expiryDate);

            document.getElementById("isActive").value =
                String(coupon.isActive);

            updateDiscountFields();

            formTitle.textContent = "Edit Coupon";

            saveCouponBtn.textContent = "Update Coupon";

            showForm();

            return;
        }

        // TOGGLE STATUS
        if (action === "toggle") {

            const confirmed = confirm(
                `Are you sure you want to ${coupon.isActive ? "disable" : "enable"} this coupon?`
            );

            if (!confirmed) return;

            try {

                await apiRequest(
                    `${API_URL}/${encodeURIComponent(id)}/status`,
                    { method: "PATCH" }
                );

                await loadCoupons();

            } catch (error) {

                alert(error.message);
            }

            return;
        }

        // DELETE
        if (action === "delete") {

            const confirmed = confirm(
                `Are you sure you want to delete coupon ${coupon.code}?`
            );

            if (!confirmed) return;

            try {

                const data = await apiRequest(
                    `${API_URL}/${encodeURIComponent(id)}`,
                    { method: "DELETE" }
                );

                alert(data.message || "Coupon deleted successfully.");

                await loadCoupons();

            } catch (error) {

                alert(error.message);
            }
        }
    });

    // SEARCH COUPONS
    couponSearch.addEventListener("input", () => {

        const searchValue = couponSearch.value.trim().toLowerCase();

        const filteredCoupons = coupons.filter(coupon =>
            String(coupon.code || "")
                .toLowerCase()
                .includes(searchValue)
        );

        renderCoupons(filteredCoupons);
    });

    // DATE CONVERSION
    function toDateTimeLocal(date) {

        if (!date) return "";

        const parsed = new Date(date);

        if (Number.isNaN(parsed.getTime())) return "";

        const offset = parsed.getTimezoneOffset() * 60000;

        return new Date(parsed.getTime() - offset)
            .toISOString()
            .slice(0, 16);
    }

    // INITIAL LOAD
    updateDiscountFields();
    loadCoupons();

});
