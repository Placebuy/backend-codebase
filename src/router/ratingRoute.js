// routes/ratingRoutes.js
const express = require('express');

const router = express.Router();
const ratingController = require('../controllers/ratingController');

// Route to submit a rating
router.post('/', ratingController.submitFoodRating);


module.exports = router;
