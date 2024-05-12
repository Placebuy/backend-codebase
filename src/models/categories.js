const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },

    image: {
      type: String,
    },
    numberOfItems: {
      type: Number,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
  },

  { timestamps: true },
);

const Category = mongoose.model('Category', categorySchema);
module.exports = Category;
