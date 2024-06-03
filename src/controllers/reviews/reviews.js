const httpStatus = require('http-status');
const Asyncly = require('../../utils/Asyncly');
const ApiError = require('../../utils/ApiError');
//const Food = require('../models/food');
//const Restaurant = require('../models/restaurant');
//const logger = require('../../config/logger');
const cloudinary = require('cloudinary').v2;
const productValidation = require('../../validation/productValidation');
const Product = require('../../models/products');
const { paginate } = require('../../utils/pagination');
const Review = require('../../models/reviews');
const reviewSchema = require('../../validation/reviewValidation');

const createReview = Asyncly(async (req, res) => {
  const reviewData = reviewSchema.parse(req.body);
  const { userId } = req;
  const { productId } = req.params;

  const product = await Product.findById(productId).exec();
  if (!product) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Product not found');
  }
  const newReview = new Review({
    ...reviewData,
    buyerId: userId,
    productId,
  });
  await newReview.save();
  return res.status(httpStatus.CREATED).json({
    message: 'Review created successfully',
    data: newReview,
  });
});

const getProductReviews = Asyncly(async (req, res) => {
  const { productId } = req.params;
  const query = { productId };
  const { metadata, results } = await paginate(Review, req, query);
  if (!results.length) {
    throw new ApiError(httpStatus.NOT_FOUND, 'No review for this product');
  }
  return res.status(httpStatus.OK).json({ metadata, results });
});

const getReviewById = Asyncly(async (req, res) => {
  const { reviewId } = req.params;
  const review = await Review.findById(reviewId).exec();
  if (!review) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Review not found');
  }
  return res.status(httpStatus.OK).json(review);
});

const updateReview = Asyncly(async (req, res) => {
  const reviewData = reviewSchema.parse(req.body);
  const { reviewId } = req.params;
  const review = await Review.findById(reviewId).exec();
  if (!review) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Review not found');
  }
  Object.assign(review, reviewData);
  await review.save();
  return res.status(httpStatus.OK).json({
    message: 'Review updated successfully',
    data: review,
  });
});

const deleteReview = Asyncly(async (req, res) => {
  const { reviewId } = req.params;
  const review = await Review.findById(reviewId).exec();
  if (!review) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Review not found');
  }
  await review.remove();
  return res.status(httpStatus.NO_CONTENT).send();
});

const listTopProductsByReviews = Asyncly(async (req, res) => {
  const aggregateResult = await Review.aggregate([
    {
      $group: {
        _id: '$productId',
        averageRating: { $avg: '$rating' },
      },
    },
    {
      $sort: { averageRating: -1 },
    },
    //{
    //  $limit: 10,
    // },
  ]);
  const productIds = aggregateResult.map((item) => item._id);

  const query = { _id: { $in: productIds } };
  const { metadata, results } = await paginate(Product, req, query);
  if (!results.length) {
    throw new ApiError(httpStatus.NOT_FOUND, 'No top rated products');
  }
  return res.status(httpStatus.OK).json({ metadata, results });
});

module.exports = {
  createReview,
  getProductReviews,
  getReviewById,
  updateReview,
  deleteReview,
  listTopProductsByReviews,
};
