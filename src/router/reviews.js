const express = require('express');
const validate = require('../utils/validate');
const reviewValidation = require('../validation/reviewValidation');
//const registerVendor  = require('../controllers/vendor/auth');
//const registerBuyer = require('../controllers/buyers/auth');
//const registerAdmin = require('../controllers/admin/auth');
const { requireAuth } = require('../middleware/authMiddleware');
const {
  createReview,
  getProductReviews,
  getReviewById,
  updateReview,
  deleteReview,
  listTopProductsByReviews,
} = require('../controllers/reviews/reviews');

const router = express.Router();

router.post(
  '/:productId',
  validate(reviewValidation),
  requireAuth,
  createReview,
);

router.get('/:reviewId', getReviewById)
//router.get('/product/:productId', getProductReviews)

router.put('/:reviewId', requireAuth, updateReview)
router.delete('/:reviewId', requireAuth, deleteReview)
router.get('/top-products', listTopProductsByReviews)

module.exports = router
