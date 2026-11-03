const loginForm = document.getElementById("adminLoginForm");

loginForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {

        const response = await fetch("/admin/login", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                username: username,
                password: password
            })

        });

        if (response.redirected) {
            window.location.href = response.url;
            return;
        }

        const data = await response.json();

        if (!response.ok) {
            document.getElementById("message").textContent =
                data.message || "Login failed";
        }

    } catch (error) {

        console.error("Login error:", error);

        document.getElementById("message").textContent =
            "Something went wrong";

    }

});

async function deleteUser(id) {

    const confirmDelete = confirm(
        "Are you sure you want to delete this user?"
    );

    if (!confirmDelete) {
        return;
    }

    try {

        const response = await fetch(`/admin/delete/${id}`, {
            method: "POST"
        });

        if (!response.ok) {
            throw new Error("Delete failed");
        }

        window.location.reload();

    } catch (error) {

        console.error("Delete error:", error);

        alert("Unable to delete user");

    }
}