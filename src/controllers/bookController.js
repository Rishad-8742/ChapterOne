const Book = require("../models/bookModel");
const mongoose = require("mongoose");

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");


//new arrivals in home page//
const getNewArrivals = async (req, res) => {
    try {
        const books = await Book.find()
            .sort({ createdAt: -1, _id: -1 })
            .limit(3)
            .lean();

        return res.status(200).json({
            success: true,
            books
        });

    } catch (error) {
        console.error("New arrivals error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to load new arrivals"
        });
    }
};

// CREATE BOOK
const createBook = async (req, res) => {
    try {

        const {
            title,
            author,
            description,
            price,
            language,
            genre,
            image,
            stock
        } = req.body;


        // Validation
        if (!title || !title.trim()) {
            return res.status(400).json({
                success: false,
                message: "Title is required"
            });
        }

        if (!author || !author.trim()) {
            return res.status(400).json({
                success: false,
                message: "Author is required"
            });
        }

        if (!language || !language.trim()) {
            return res.status(400).json({
                success: false,
                message: "language is required"
            });
        }

        if (!genre || !genre.trim()) {
            return res.status(400).json({
                success: false,
                message: "Genre is required"
            });
        }

        if (price === undefined || price === "") {
            return res.status(400).json({
                success: false,
                message: "Price is required"
            });
        }

        if (Number(price) < 0) {
            return res.status(400).json({
                success: false,
                message: "Price cannot be negative"
            });
        }


        const book = new Book({
            title: title.trim(),
            author: author.trim(),
            description: description ? description.trim() : "",
            price: Number(price),
            language: language.trim(),
            genre: genre.trim(),
            image: image || "",
            stock: stock !== undefined ? Number(stock) : 0
        });


        await book.save();


        return res.status(201).json({
            success: true,
            message: "Book created successfully",
            book
        });

    } catch (error) {

        console.error("Create book error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create book"
        });
    }
};

// GET ALL BOOKS

const getBooks = async (req, res) => {
    try {
        const books = await Book.find().sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: books.length,
            books
        });
    } catch (error) {
        console.error("Get books error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to view books"
        });
    }
};

// FETCH SINGLE BOOK
const getBook = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid book ID"
            });
        }

        const book = await Book.findById(id);

        if (!book) {
            return res.status(404).json({
                success: false,
                message: "Book not found"
            });
        }

        return res.status(200).json({
            success: true,
            book
        });

    } catch (error) {
        console.error("Fetch book error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to view book"
        });
    }
};


const updateBook = async (req, res) => {
    try {
        const {
            title,
            author,
            description,
            price,
            language,
            genre,
            stock,
            imageBase64,
            image2Base64
        } = req.body;

        // VALIDATION
        if (!title || !title.trim()) {
            return res.status(400).json({
                success: false,
                message: "Title is required"
            });
        }

        if (!author || !author.trim()) {
            return res.status(400).json({
                success: false,
                message: "Author is required"
            });
        }

        if (!language || !language.trim()) {
            return res.status(400).json({
                success: false,
                message: "Language is required"
            });
        }

        if (!genre || !genre.trim()) {
            return res.status(400).json({
                success: false,
                message: "Genre is required"
            });
        }

        if (
            price === undefined ||
            price === "" ||
            !Number.isFinite(Number(price)) ||
            Number(price) < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid price"
            });
        }

        if (
            stock === undefined ||
            stock === "" ||
            !Number.isInteger(Number(stock)) ||
            Number(stock) < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Stock must be a non-negative integer"
            });
        }

        // FIND EXISTING BOOK
        const book = await Book.findById(req.params.id);

        if (!book) {
            return res.status(404).json({
                success: false,
                message: "Book not found"
            });
        }

        // UPLOAD DIRECTORY
        const uploadDir = path.join(
            __dirname,
            "../../public/uploads/books"
        );

        fs.mkdirSync(uploadDir, { recursive: true });

        // CONVERT BASE64 AND SAVE IMAGE
        const saveBase64Image = (base64, fieldName) => {
            if (!base64) {
                return null;
            }

            const match = base64.match(
                /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/
            );

            if (!match) {
                throw new Error(
                    `${fieldName} must be a valid JPG, PNG, or WEBP image`
                );
            }

            const extension =
                match[1] === "jpeg" ? "jpg" : match[1];

            const buffer = Buffer.from(match[2], "base64");

            if (!buffer.length || buffer.length > 5 * 1024 * 1024) {
                throw new Error(
                    `${fieldName} must be 5 MB or smaller`
                );
            }

            const filename =
                `${crypto.randomUUID()}.${extension}`;

            const absolutePath = path.join(
                uploadDir,
                filename
            );

            fs.writeFileSync(absolutePath, buffer);

            return `/uploads/books/${filename}`;
        };

        // UPDATE BOOK DETAILS
        book.title = title.trim();
        book.author = author.trim();
        book.description = (description || "").trim();
        book.price = Number(price);
        book.language = language.trim();
        book.genre = genre.trim();
        book.stock = Number(stock);

        // ONLY REPLACE IMAGES WHEN NEW ONES ARE SELECTED
        // null means keep the previously saved image.
        if (imageBase64) {
            book.image = saveBase64Image(
                imageBase64,
                "Front cover"
            );
        }

        if (image2Base64) {
            book.image2 = saveBase64Image(
                image2Base64,
                "Back cover"
            );
        }

        await book.save();

        return res.status(200).json({
            success: true,
            message: "Book updated successfully",
            book
        });

    } catch (error) {
        console.error("Update book error:", error);

        return res.status(400).json({
            success: false,
            message: error.message || "Failed to update book"
        });
    }
};

// DELETE BOOK
const deleteBook = async (req, res) => {

    try {

        const book = await Book.findByIdAndDelete(
            req.params.id
        );


        if (!book) {

            return res.status(404).json({
                success: false,
                message: "Book not found"
            });
        }


        return res.status(200).json({
            success: true,
            message: "Book deleted successfully"
        });

    } catch (error) {

        console.error("Delete book error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete book"
        });
    }
};

// ADD PRODUCT PAGE
const getAddProduct = (req, res) => {

    res.render("admin/addProduct");

};

// ADD PRODUCT
const addProduct = async (req, res) => {

    try {
        console.log("BODY:", req.body);
console.log("FILE:", req.file);
        const {
            title,
            author,
            language,
            genre,
            price,
            description
        } = req.body;

        // VALIDATION

        if (!title || !title.trim()) {

            return res.status(400).json({
                success: false,
                message: "Title is required"
            });
        }


        if (!author || !author.trim()) {

            return res.status(400).json({
                success: false,
                message: "Author is required"
            });
        }


        if (!language || !language.trim()) {

            return res.status(400).json({
                success: false,
                message: "language is required"
            });
        }


        if (!genre || !genre.trim()) {

            return res.status(400).json({
                success: false,
                message: "Genre is required"
            });
        }


        if (price === undefined || price === "") {

            return res.status(400).json({
                success: false,
                message: "Price is required"
            });
        }


        if (Number(price) < 0) {

            return res.status(400).json({
                success: false,
                message: "Price cannot be negative"
            });
        }
     
        // FRONT COVER AND BACK COVER
        const frontCover = req.files?.image?.[0];
        const backCover = req.files?.image2?.[0];

        const imagePath = frontCover
            ? "/uploads/books/" + frontCover.filename
            : "";

        const image2Path = backCover
            ? "/uploads/books/" + backCover.filename
            : "";

        // CREATE BOOK

        const book = new Book({
            title: title.trim(),
            author: author.trim(),
            description: description ? description.trim() : "",
            language: language.trim(),
            genre: genre.trim(),
            price: Number(price),
            image: imagePath,
            image2: image2Path,
            stock: 0
        });

      await book.save();

        // RESPONSE

        return res.status(201).json({

            success: true,

            message: "Book added successfully",

            book

        });

    } catch (error) {

        console.error(
            "Add product error:",
            error
        );

        return res.status(500).json({

            success: false,

            message: "Failed to add book"

        });
    }
};


const addToCart = async (req, res) => {
    try {
        const { bookId, quantity = 1 } = req.body;

        if (
            !mongoose.Types.ObjectId.isValid(bookId) ||
            !Number.isInteger(quantity) ||
            quantity < 1
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid book or quantity"
            });
        }

        const book = await Book.findById(bookId);

        if (!book) {
            return res.status(404).json({
                success: false,
                message: "Book not found"
            });
        }

        if (!req.user.cart) {
            req.user.cart = [];
        }

        const item = req.user.cart.find(
            item => String(item.bookId) === String(bookId)
        );

        const newQuantity = (item?.quantity || 0) + quantity;

        if (newQuantity > book.stock) {
            return res.status(400).json({
                success: false,
                message: "Requested quantity exceeds available stock"
            });
        }

        if (item) {
            item.quantity = newQuantity;
        } else {
            req.user.cart.push({
                bookId: book._id,
                quantity
            });
        }

        await req.user.save();

        return res.json({
            success: true,
            message: "Book added to cart",
            count: req.user.cart.reduce(
                (sum, item) => sum + item.quantity,
                0
            )
        });
    } catch (error) {
        console.error("Add to cart error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to add book"
        });
    }
};


// Get complete cart data

const getCartData = async (req, res) => {
    try {
        const cart = req.user.cart || [];
        const ids = cart.map(item => item.bookId);

        const books = await Book.find({
            _id: { $in: ids }
        }).lean();

        const bookMap = new Map(
            books.map(book => [String(book._id), book])
        );

        const items = cart.flatMap(item => {
            const book = bookMap.get(String(item.bookId));

            if (!book) return [];

            return [{
                bookId: String(book._id),
                title: book.title,
                author: book.author,
                image: book.image,
                price: book.price,
                stock: book.stock,
                quantity: item.quantity,
                subtotal: book.price * item.quantity
            }];
        });

        const totalQuantity = items.reduce(
            (sum, item) => sum + item.quantity,
            0
        );

        const total = items.reduce(
            (sum, item) => sum + item.subtotal,
            0
        );

        return res.json({
            success: true,
            items,
            totalQuantity,
            total
        });
    } catch (error) {
        console.error("Get cart error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to load cart"
        });
    }
};

// Update a cart item's quantity

const updateCartItem = async (req, res) => {
    try {
        const { bookId } = req.params;
        const { quantity } = req.body;

        if (
            !mongoose.Types.ObjectId.isValid(bookId) ||
            !Number.isInteger(quantity) ||
            quantity < 1
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid quantity"
            });
        }

        const item = (req.user.cart || []).find(
            item => String(item.bookId) === String(bookId)
        );

        if (!item) {
            return res.status(404).json({
                success: false,
                message: "Cart item not found"
            });
        }

        const book = await Book.findById(bookId);

        if (!book) {
            return res.status(404).json({
                success: false,
                message: "Book not found"
            });
        }

        if (quantity > book.stock) {
            return res.status(400).json({
                success: false,
                message: "Quantity exceeds available stock"
            });
        }

        item.quantity = quantity;
        await req.user.save();

        return res.json({
            success: true,
            message: "Quantity updated"
        });

    } catch (error) {
        console.error("Update cart error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to update quantity"
        });
    }
};


// Remove a book from the cart
const removeCartItem = async (req, res) => {
    try {
        const { bookId } = req.params;

        req.user.cart = (req.user.cart || []).filter(
            item => String(item.bookId) !== String(bookId)
        );

        await req.user.save();

        return res.json({
            success: true,
            message: "Book removed from cart"
        });
    } catch (error) {
        console.error("Remove cart item error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to remove book"
        });
    }
};


// Get navbar cart count
const getCartCount = (req, res) => {
    const count = (req.user.cart || []).reduce(
        (sum, item) => sum + item.quantity,
        0
    );

    return res.json({ success: true, count });
};
// EXPORT


module.exports = {

    createBook,

    getBooks,

    getBook,

    updateBook,

    deleteBook,

    getAddProduct,

    addProduct,

    addToCart,

    getNewArrivals,
   
    getCartData,

    updateCartItem,

    removeCartItem,

    getCartCount

};