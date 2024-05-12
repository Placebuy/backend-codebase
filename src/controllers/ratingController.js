const httpStatus = require('http-status');
const Rating = require('../models/rating');
const Asyncly = require('../utils/Asyncly');
const ApiError = require('../utils/ApiError');
const Food = require('../models/food');
const Restaurant = require('../models/restaurant');

const submitFoodRating = Asyncly(async (req, res) => {
	const { userId, foodId, rating } = req.body;

	// Validate rating value (1 to 5)
	if (rating < 1 || rating > 5) {
		throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid rating value');
	}

	// Fetch the food and restaurant associated with the given foodId
	const food = await Food.findById(foodId);
	if (!food) {
		throw new ApiError(httpStatus.NOT_FOUND, 'Food not found');
	}

	const restaurantId = food.restaurant;

	// Create a new rating
	const newRating = new Rating({ userId, foodId, restaurantId, rating });
	await newRating.save();

	// Update the averageRating property in the Food model
	await updateFoodAverageRating(foodId);

	// Update the averageRating property in the Restaurant model
	await updateRestaurantAverageRating(restaurantId);

	res.status(httpStatus.CREATED).json({
		message: 'Rating submitted successfully',
	});
});

async function updateFoodAverageRating(foodId) {
	const ratings = await Rating.find({ foodId });

	// Calculate the total rating for the food
	const totalRating = ratings.reduce((sum, rating) => sum + rating.rating, 0);

	// Calculate the average rating for the food
	const averageRating = ratings.length > 0 ? totalRating / ratings.length : 0;

	// Round the average rating to one decimal place
	const roundedAverageRating = Number(averageRating.toFixed(1));

	// Update the averageRating property in the Food model
	await Food.findByIdAndUpdate(foodId, {
		averageRating: roundedAverageRating,
		ratingTotal: ratings.length,
	});
}

async function updateRestaurantAverageRating(restaurantId) {
	// Find all ratings for the specified restaurant's foods
	const foodRatings = await Rating.find({ restaurantId });

	// Calculate the average rating for the restaurant based on its foods
	const averageRating = calculateAverageRestaurantRating(foodRatings);

	// Update the averageRating property in the Restaurant model
	await Restaurant.findByIdAndUpdate(restaurantId, {
		averageRating,
		ratingTotal: foodRatings.length,
	});
}

function calculateAverageRestaurantRating(foodRatings) {
	const totalFoodRatings = foodRatings.length;

	if (totalFoodRatings === 0) {
		return 0;
	}

	const sumRatings = foodRatings.reduce(
		(acc, rating) => acc + rating.rating,
		0,
	);
	const averageRating = sumRatings / totalFoodRatings;

	return Number(averageRating.toFixed(1));
}

module.exports = {
	submitFoodRating,
};
