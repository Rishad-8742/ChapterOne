const signupForm = document.getElementById("signupForm");

const userName = document.getElementById("userName");
const userEmail = document.getElementById("userEmail");
const userPassword = document.getElementById("userPassword");
const confirmPassword = document.getElementById("confirmPassword");

const userNameError = document.getElementById("userNameError");
const userEmailError = document.getElementById("userEmailError");
const userPasswordError = document.getElementById("userPasswordError");
const confirmPasswordError =
    document.getElementById("confirmPasswordError");


// FULL NAME VALIDATION

userName.addEventListener("input", function () {

    const name = userName.value.trim();

    if (name === "") {

        userNameError.textContent =
            "Name is required";

    } else if (name.length < 2) {

        userNameError.textContent =
            "Name must be at least 2 characters";

    } else if (name.length > 40) {

        userNameError.textContent =
            "Name must not exceed 40 characters";

    } else {

        userNameError.textContent = "";

    }
});


// EMAIL VALIDATION

userEmail.addEventListener("input", function () {

    const email = userEmail.value.trim();

    const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (email === "") {

        userEmailError.textContent =
            "Email is required";

    } else if (!emailPattern.test(email)) {

        userEmailError.textContent =
            "Enter a valid email address";

    } else {

        userEmailError.textContent = "";

    }
});


// PASSWORD VALIDATION

userPassword.addEventListener("input", function () {

    if (userPassword.value === "") {

        userPasswordError.textContent =
            "Password is required";

    } else if (userPassword.value.length < 8) {

        userPasswordError.textContent =
            "Password must contain at least 8 characters";

    } else {

        userPasswordError.textContent = "";

    }

    checkConfirmPassword();
});


// CONFIRM PASSWORD

confirmPassword.addEventListener("input", function () {

    checkConfirmPassword();

});


function checkConfirmPassword() {

    if (confirmPassword.value === "") {

        confirmPasswordError.textContent =
            "Please confirm your password";

    } else if (
        confirmPassword.value !== userPassword.value
    ) {

        confirmPasswordError.textContent =
            "Passwords do not match";

    } else {

        confirmPasswordError.textContent = "";

    }
}


// FORM SUBMIT + FETCH

signupForm.addEventListener("submit", async function (event) {

    // Stop normal browser form submission
    event.preventDefault();


    let isValid = true;


    // NAME

    const name = userName.value.trim();

    if (
        name === "" ||
        name.length < 2 ||
        name.length > 40
    ) {

        isValid = false;

    }


    // EMAIL

    const email = userEmail.value.trim();

    const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (
        email === "" ||
        !emailPattern.test(email)
    ) {

        isValid = false;

    }


    // PASSWORD


    if (userPassword.value.length < 8) {

        isValid = false;

    }

    // CONFIRM PASSWORD

    if (
        confirmPassword.value === "" ||
        confirmPassword.value !== userPassword.value
    ) {

        isValid = false;

    }

    // STOP IF INVALID


    if (!isValid) {

        return;

    }


    // SEND DATA USING FETCH


try {
    const formData = new URLSearchParams();

    formData.append("userName", name);
    formData.append("userEmail", email);
    formData.append("userPassword", userPassword.value);
    formData.append("confirmPassword", confirmPassword.value);

    const response = await fetch("/user/signup", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json"
        },
        credentials: "include",
        body: formData.toString()
    });

    const result = await response.json();

    if (result.success) {
        window.location.href = result.redirect;
        return;
    }

    userEmailError.textContent =
        result.message || "Signup failed. Please try again.";

} catch (error) {
    console.error("Signup error:", error);
    userEmailError.textContent =
        "Unable to complete signup. Please try again.";
}


});
