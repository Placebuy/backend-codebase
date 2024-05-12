const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Buyer',
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    ratingTotal: {
      type: Number,
      default: 0,
    },
    comment: {
      type: String,
      required: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

reviewSchema.post(/^find/, async function (docs) {
  for (const doc of docs) {
    const totalReviews = await this.model.countDocuments({productId: doc.productId})
    await this.model.updateOne({productId: doc.productId}, {ratingTotal: totalReviews})
  }
})

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
