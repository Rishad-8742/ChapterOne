const form = document.getElementById("adminLoginForm");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const errorMsg = document.getElementById("errorMsg");

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorMsg.textContent = "";

    try {
        const response = await fetch("/admin/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: usernameInput.value.trim(),
                password: passwordInput.value
            })
        });

        const result = await response.json();

        if (result.success) {
            window.location.replace(result.redirect);
            return;
        }
        errorMsg.textContent = result.message;
    } catch (error) {
        console.error("Login error:", error);
        errorMsg.textContent = "Something went wrong";
    }
});   