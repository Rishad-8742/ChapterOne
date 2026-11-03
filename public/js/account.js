
"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("profileForm");
    const nameInput = document.getElementById("userName");
    const emailInput = document.getElementById("userEmail");
    const phoneInput = document.getElementById("phone");
    const saveButton = document.getElementById("saveProfileBtn");
    const message = document.getElementById("accountMessage");

    if (!form || !nameInput || !emailInput || !phoneInput) return;

    function showMessage(text, type = "error") {
        if (!message) return;

        message.textContent = text;
        message.classList.remove("success", "error");
        message.classList.add(type);
    }

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

    async function loadProfile() {
        try {
            const data = await apiRequest("/user/api/account");
            const profile = data.profile;

            if (!profile) {
                throw new Error("Profile data was not returned by the server.");
            }

            nameInput.value = profile.userName || "";
            emailInput.value = profile.userEmail || "";
            phoneInput.value = profile.phone || "";

        } catch (error) {
            console.error("Load profile error:", error);
            showMessage(error.message || "Unable to load profile.");
        }
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const userName = nameInput.value.trim();
        const userEmail = emailInput.value.trim();
        const phone = phoneInput.value.trim();

        if (userName.length < 2 || userName.length > 40) {
            showMessage("Name must contain 2–40 characters.");
            return;
        }

        if (!emailInput.checkValidity()) {
            showMessage("Please enter a valid email address.");
            return;
        }

        if (phone && !/^[6-9]\d{9}$/.test(phone)) {
            showMessage("Enter a valid 10-digit Indian phone number.");
            return;
        }

        saveButton.disabled = true;
        saveButton.textContent = "Saving...";

        try {
            const data = await apiRequest("/user/api/account", {
                method: "PATCH",
                body: JSON.stringify({
                    userName,
                    userEmail,
                    phone
                })
            });

            showMessage(
                data.message || "Profile updated successfully.",
                "success"
            );

            // Use the values returned by the database update.
            if (data.profile) {
                nameInput.value = data.profile.userName || "";
                emailInput.value = data.profile.userEmail || "";
                phoneInput.value = data.profile.phone || "";
            }

            // Confirm the latest persisted values with a fresh GET.
            await loadProfile();

        } catch (error) {
            console.error("Save profile error:", error);
            showMessage(error.message || "Unable to save profile.");
        } finally {
            saveButton.disabled = false;
            saveButton.textContent = "✓ Save Changes";
        }
    });

    // Fetch saved details every time the account page loads.
    loadProfile();
});
