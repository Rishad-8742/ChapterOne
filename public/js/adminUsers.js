// 1. Get the elements from the page
const usersBody = document.getElementById("usersBody");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const verifiedFilter = document.getElementById("verifiedFilter");
const pageInfo = document.getElementById("pageInfo");
const totalInfo = document.getElementById("totalInfo");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

let currentPage = 1;


// 2. Make text safe before putting it in the table
function safe(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}


// 3. Get users from the server and show them
async function loadUsers(page) {
    currentPage = page;

    const url =
        "/admin/users/data" +
        "?q=" + encodeURIComponent(searchInput.value.trim()) +
        "&status=" + statusFilter.value +
        "&verified=" + verifiedFilter.value +
        "&page=" + page;

    const response = await fetch(url, {
        headers: { "X-Requested-With": "fetch" }
    });

    // session expired: go back to login
    if (response.status === 401) {
        window.location.replace("/admin/login");
        return;
    }

    const data = await response.json();

    if (!data.success) {
        alert(data.message);
        return;
    }

    showUsers(data.users);

    pageInfo.textContent = "Page " + data.page + " of " + data.totalPages;
    totalInfo.textContent = data.total + " users";

    prevBtn.disabled = data.page <= 1;
    nextBtn.disabled = data.page >= data.totalPages;
}


// 4. Build the table rows
function showUsers(users) {
    if (users.length === 0) {
        usersBody.innerHTML = '<tr><td colspan="5" class="empty">No users found</td></tr>';
        return;
    }

    let rows = "";

    users.forEach(function (user) {
        const verifiedBadge = user.isVerified
            ? '<span class="badge active">Verified</span>'
            : '<span class="badge pending">Unverified</span>';

        const statusBadge = user.isBlocked
            ? '<span class="badge blocked">Blocked</span>'
            : '<span class="badge active">Active</span>';

        const buttonText = user.isBlocked ? "Unblock" : "Block";
        const buttonClass = user.isBlocked ? "btn-light" : "danger";

        rows += `
            <tr>
                <td>${safe(user.userName)}</td>
                <td>${safe(user.userEmail)}</td>
                <td>${verifiedBadge}</td>
                <td>${statusBadge}</td>
                <td>
                    <button class="${buttonClass} btn-sm block-btn" data-id="${user._id}">
                        ${buttonText}
                    </button>
                </td>
            </tr>
        `;
    });

    usersBody.innerHTML = rows;
}


// 5. Block or unblock a user
async function toggleBlock(id) {
    const response = await fetch("/admin/users/" + id + "/block", {
        method: "PATCH",
        headers: { "X-Requested-With": "fetch" }
    });

    const data = await response.json();

    if (!data.success) {
        alert(data.message);
        return;
    }

    loadUsers(currentPage);   // reload the table to show the new status
}


// 6. Listen for clicks and typing

// click on any Block / Unblock button
usersBody.addEventListener("click", function (event) {
    if (event.target.classList.contains("block-btn")) {
        toggleBlock(event.target.dataset.id);
    }
});

// search and filters: start again from page 1
searchInput.addEventListener("input", function () {
    loadUsers(1);
});
statusFilter.addEventListener("change", function () {
    loadUsers(1);
});
verifiedFilter.addEventListener("change", function () {
    loadUsers(1);
});

// previous and next buttons
prevBtn.addEventListener("click", function () {
    loadUsers(currentPage - 1);
});
nextBtn.addEventListener("click", function () {
    loadUsers(currentPage + 1);
});



loadUsers(1);