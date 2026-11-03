
const loginForm = document.getElementById("loginForm");

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const userEmail = document.getElementById("userEmail").value.trim();
    const userPassword = document.getElementById("userPassword").value;

    // Remove previous error message
    let loginError = document.getElementById("loginError");

    if (!loginError) {
        loginError = document.createElement("p");
        loginError.id = "loginError";
        loginError.setAttribute("role", "alert");
        loginForm.insertBefore(loginError, loginForm.querySelector(".login-btn"));
    }

    loginError.textContent = "";

    try {
        const response = await fetch("/user/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                userEmail,
                userPassword
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            window.location.href = data.redirect;
            return;
        }

        loginError.textContent = data.message || "Login failed. Please try again.";

    } catch (error) {
        console.error("Login error:", error);
        loginError.textContent = "Unable to connect to the server. Please try again.";
    }
});
