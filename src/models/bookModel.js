const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    author: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    image: { type: String, default: '' },
    image2: {type: String,default: ""},
    genre: { type: String, default: '' },
    language:{type: String,default:''},
    description: { type: String, default: '' },
    stock: { type: Number, default: 10 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Book', bookSchema);    