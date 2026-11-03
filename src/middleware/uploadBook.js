const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({

    destination: function (req, file, cb) {

        cb(
            null,
            path.join(__dirname, "../../public/uploads/books")
        );

    },

    filename: function (req, file, cb) {

        const uniqueName =
            Date.now() + "-" +
            Math.round(Math.random() * 1E9) +
            path.extname(file.originalname);

        cb(null, uniqueName);
    }
});

const fileFilter = function (req, file, cb) {

    const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp"
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Only JPG, JPEG, PNG and WEBP images are allowed"));
    }
};

const uploadBookImage = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

module.exports = uploadBookImage.fields([
    { name: "image", maxCount: 1 },
    { name: "image2", maxCount: 1 }
]);