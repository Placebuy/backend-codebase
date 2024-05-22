const { required } = require('joi');
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
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
      default: 1,
    },
    image: {
      type: String,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    type: {
      type: String,
      enum: ['new', 'used'],
    },
    reviewTotal: {
      type: Number,
      default: 0,
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

productSchema.pre('save', function (next) {
  // Check if the title field exists and is a string
  if (this.title && typeof this.title === 'string') {
    // Convert the first letter to uppercase
    this.title = this.title.charAt(0).toUpperCase() + this.title.slice(1);
  }
  next();
});

productSchema.post(/^findOne/, async function (doc, next) {
  if (doc && !doc.__updatedByHook) {
    const Review = mongoose.model('Review');
    const totalReviews = await Review.countDocuments({
      productId: doc._id,
    });
    if (totalReviews !== doc.reviewTotal) {
      await this.findByIdAndUpdate(doc._id, { reviewTotal: totalReviews, __updatedByHook: true });
      
    }
    next();
  }
});

// Pre-save hook to capitalize the first letter of the title field
// productSchema.pre('save', function (next) {
//   // Check if the title field exists and is a string
//   if (this.title && typeof this.title === 'string') {
//     // Convert the first letter to uppercase
//     this.title = this.title.charAt(0).toUpperCase() + this.title.slice(1);
//   }
//   next();
// });

module.exports = mongoose.model('Product', productSchema);

// productSchema.virtual('reviews', {
//   ref: 'Review',
//   localField: '_id',
//   foreignField: 'productId',
// });

// productSchema.set('toObject', { virtuals: true });
// productSchema.set('toJSON', { virtuals: true });

// module.exports = mongoose.model('Product', productSchema);
//  const product = await Product.findById(productId).populate('reviews').exec();
