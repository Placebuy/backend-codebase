const { required } = require('joi');
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
		vendor: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Seller',
		},
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
    },
    availableUnits: {
      type: Number,
      default: 0,
    },
    image: {
      type: String,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
		/**discount: {
      type: Number,
      default: null,
      min: 0,
      max: 1,
    },*/
  },
  { timestamps: true },
);

// Pre-save hook to capitalize the first letter of the title field
productSchema.pre('save', function (next) {
  // Check if the title field exists and is a string
  if (this.title && typeof this.title === 'string') {
    // Convert the first letter to uppercase
    this.title = this.title.charAt(0).toUpperCase() + this.title.slice(1);
  }
  next();
});

module.exports = mongoose.model('Product', productSchema);
