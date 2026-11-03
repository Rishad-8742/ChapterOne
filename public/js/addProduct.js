const form = document.getElementById("addProductForm");

const formError = document.getElementById("formError");

const saveBtn = document.getElementById("saveBtn");

const toast = document.getElementById("toast");


form.addEventListener("submit", async function (event) {

    event.preventDefault();

    formError.textContent = "";

    // CREATE FORMDATA

    const formData = new FormData(form);
 
    // DISABLE BUTTON
  
    saveBtn.disabled = true;

    saveBtn.textContent = "Saving...";

    try {

        const response = await fetch(
            "/admin/products",
            {
                method: "POST",
                body: formData
            }
        );


        const result = await response.json();


        console.log("Add product response:", result);

        // ERROR
      
        if (!response.ok || !result.success) {

            formError.textContent =
                result.message || "Something went wrong";

            return;

        }
  
        // SUCCESS
  
        showToast(
            result.message || "Book added successfully",
            "success"
        );


        form.reset();


        setTimeout(function () {

            window.location.href =
                "/admin/products";

        }, 1000);


    } catch (error) {

        console.error(
            "Add product error:",
            error
        );

        formError.textContent =
            "Server error. Please try again.";

    } finally {

        saveBtn.disabled = false;

        saveBtn.textContent = "Add Book";

    }

});

// TOAST

function showToast(message, type = "success") {

    toast.textContent = message;

    toast.className =
        "toast " + type + " show";


    setTimeout(function () {

        toast.className = "toast";

    }, 3000);

}


// FRONT COVER PREVIEW
const frontInput = document.getElementById("image");
const frontPreview = document.getElementById("frontCoverPreview");

// BACK COVER PREVIEW
const backInput = document.getElementById("image2");
const backPreview = document.getElementById("backCoverPreview");

function previewImage(input, preview) {
    input.addEventListener("change", function () {
        const file = input.files[0];

        if (!file) {
            preview.removeAttribute("src");
            preview.hidden = true;
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            alert("Image size must be 5 MB or less.");
            input.value = "";
            preview.removeAttribute("src");
            preview.hidden = true;
            return;
        }

        preview.src = URL.createObjectURL(file);
        preview.hidden = false;
    });
}

previewImage(frontInput, frontPreview);
previewImage(backInput, backPreview);