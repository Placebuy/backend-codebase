/* eslint-disable camelcase */
/* eslint-disable import/order */
const httpStatus = require('http-status');
const Asyncly = require('../../utils/Asyncly');
const ApiError = require('../../utils/ApiError');
const Food = require('../models/food');
const Restaurant = require('../models/restaurant');
const Category = require('../../models/categories');
const Menu = require('../models/restaurantMenu');
const logger = require('../../config/logger');
const cloudinary = require('cloudinary').v2;
// const Additive = require('../models/additive');
const mongoose = require('mongoose');

const addFood = Asyncly(async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { category: categoryId, menus:menuId, additiveIds } = req.body;

    const categories = await Category.find({ _id: categoryId });
    // Check if the category exists
    // if (!categories || categories.length === 0) {
    //   throw new ApiError(
    //     httpStatus.NOT_FOUND,
    //     'Category not found',
    //   ); 
    // }

    const menus = await Menu.find({ _id: { $in: menuId } });
    // Check if all menus exist
    // if (menus.length !== menuIds.length) {
    //   throw new ApiError(httpStatus.NOT_FOUND, 'One or more menus not found');
    // } 

    const restaurant = await Restaurant.findById(restaurantId);

    if (!restaurant || !restaurant.isActive) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        'Restaurant is suspended. Cannot add food items.',
      );
    }

    // Upload the image to Cloudinary
    let uploadedImage;
    if (req.files && req.files.image) {
      const { secure_url } = await cloudinary.uploader.upload(
        req.files.image.tempFilePath,
        {
          use_filename: true,
          folder: 'FoodImage',
        },
      );
      uploadedImage = secure_url;
    } 

    const menuAvailability = menus.every((menu) => menu.isAvailable);
    const discountValue = req.body.discount ? parseFloat(req.body.discount) / 100 : null;
    const newFood = new Food({
      ...req.body,
      category: categoryId,
      menus: menuId,
      additives: additiveIds,
      restaurant: restaurantId,
      discount: discountValue,
      coordinates: {
        longitude: restaurant.longitude,
        latitude: restaurant.latitude,
      },
      image: uploadedImage,
    });

    if (!menuAvailability) {
      // Set food availability to false if any menu is not available    
      newFood.isAvailable = false;
    } 

    await newFood.save();
    await Restaurant.findByIdAndUpdate(restaurantId, {
      $inc: { totalItems: 1 },
    });

    res
      .status(httpStatus.OK)
      .json({ status: true, message: 'Food item successfully added' });
  } catch (error) {
    logger.error(error);
    if (error instanceof ApiError) {
      res
        .status(error.statusCode)
        .json({ status: false, message: error.message });
    } else {
      res
        .status(httpStatus.INTERNAL_SERVER_ERROR)
        .json({ status: false, message: 'Internal Server Error' });
    }
  }
});


const deleteDiscountAndUpdateFood = Asyncly(async (req, res) => {
	try {
		const { foodId } = req.params; // Assuming you pass the foodId in the URL parameters

		// Check if the food item exists
		const existingFood = await Food.findById(foodId);
		if (!existingFood) {
			throw new ApiError(httpStatus.NOT_FOUND, 'Food item not found');
		}

		// Check if the restaurant is active
		const restaurant = await Restaurant.findById(existingFood.restaurant);
		if (!restaurant || !restaurant.isActive) {
			throw new ApiError(
				httpStatus.FORBIDDEN,
				'Restaurant is suspended. Cannot update food items.',
			);
		}

		// Update the food model to remove discount
		existingFood.discount = 0;
		existingFood.discountExpiration = undefined;

		// Save the updated food item
		await existingFood.save();

		res.status(httpStatus.OK).json({
			status: true,
			message: 'Discount deleted and food item updated successfully',
		});
	} catch (error) {
		logger.error(error);
		if (error instanceof ApiError) {
			res
				.status(error.statusCode)
				.json({ status: false, message: error.message });
		} else {
			res
				.status(httpStatus.INTERNAL_SERVER_ERROR)
				.json({ status: false, message: 'Internal Server Error' });
		}
	}
});

const updateFoodPicture = Asyncly(async (req, res) => {
	// Assuming the restaurant ID is passed in the request params
	const { foodId } = req.params;

	// Check if a new profile picture is uploaded
	if (!req.files || !req.files.image) {
		throw new ApiError(httpStatus.BAD_REQUEST, 'No image file provided');
	}

	// Find the restaurant by ID
	let food = await Food.findById(foodId);

	if (!food) {
		throw new ApiError(httpStatus.NOT_FOUND, 'food not found');
	}

	// Upload the new profile picture to Cloudinary

	const { secure_url } = await cloudinary.uploader.upload(
		req.files.image.tempFilePath,
		{
			use_filename: true,
			folder: 'FoodImage',
		},
	);
	food = await Food.findByIdAndUpdate(
		foodId,
		{ image: secure_url },
		{ new: true },
	);

	res
		.status(httpStatus.OK)
		.json({ message: 'Food item  picture updated successfully' });
});
const getAllFoodsSorted = Asyncly(async (req, res) => {
	const clientLongitude = parseFloat(req.query.longitude);
	const clientLatitude = parseFloat(req.query.latitude);

	// eslint-disable-next-line no-restricted-globals
	if (isNaN(clientLongitude) || isNaN(clientLatitude)) {
		throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid coordinates');
	}

	// Fetch available foods
	const foods = await Food.find({
		isAvailable: true,
	})
		.populate({
			path: 'restaurant',
			select: 'isActive isAvailable',
		}).populate({
			path: 'additives',
			select: 'name additives optional requiredCount ', // Populate the additives field
			
			populate: {
				path: 'additives', // Nested population to populate the additives field inside each additive
				select: 'name price ',
			}
		// Select only the necessary fields of additives
		 
		})
		.lean();

	// Filter out foods from restaurants with isAvailable set to false
	const filteredFoods = foods.filter(
		(food) =>
			food.restaurant &&
			food.restaurant.isActive &&
			food.restaurant.isAvailable,
	);

	// Calculate the distance between client and each food item
	filteredFoods.forEach((food) => {
		if (food.isAvailable && food.restaurant && food.restaurant.isAvailable) {
			if (
				food.coordinates &&
				food.coordinates.longitude &&
				food.coordinates.latitude
			) {
				const foodLongitude = food.coordinates.longitude;
				const foodLatitude = food.coordinates.latitude;

				// Use the Haversine formula to calculate the distance
				const distance = getDistance(
					clientLatitude,
					clientLongitude,
					foodLatitude,
					foodLongitude,
				);

				// Add the distance to the food object
				food.distance = distance;
			} else {
				// Set a default distance if coordinates are missing
				food.distance = null;
			}
		}
	});

	// Sort the foods based on distance (ascending order)
	const sortedFoods = filteredFoods.sort(
		(a, b) => (a.distance || 0) - (b.distance || 0),
	);

	res.status(httpStatus.OK).json({ foods: sortedFoods });
});

// Haversine formula to calculate the distance between two points on the Earth's surface
function getDistance(lat1, lon1, lat2, lon2) {
	const R = 6371; // Radius of the Earth in kilometers
	// eslint-disable-next-line no-use-before-define
	const dLat = deg2rad(lat2 - lat1);
	// eslint-disable-next-line no-use-before-define
	const dLon = deg2rad(lon2 - lon1);
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(deg2rad(lat1)) *
			Math.cos(deg2rad(lat2)) *
			Math.sin(dLon / 2) *
			Math.sin(dLon / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	const distance = R * c;
	return distance;
}

// Function to convert degrees to radians
function deg2rad(deg) {
	return deg * (Math.PI / 180);
}
const getFoodByRestaurant = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const clientLongitude = parseFloat(req.query.longitude);
    const clientLatitude = parseFloat(req.query.latitude);

    // Validate coordinates
    if (isNaN(clientLongitude) || isNaN(clientLatitude)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid coordinates');
    }

    // Find foods by restaurant ID
    const foods = await Food.find({
      restaurant: restaurantId,
    }).populate({
			path: 'additives',
			select: 'name additives optional requiredCount ', // Populate the additives field
			
			populate: {
				path: 'additives', // Nested population to populate the additives field inside each additive
				select: 'name price ',
			}
		// Select only the necessary fields of additives
		 
		});

    // Calculate and populate the distance for each food item
    const foodsWithDistance = foods.map(food => {
      if (
        food.coordinates &&
        food.coordinates.longitude &&
        food.coordinates.latitude
      ) {
        const foodLongitude = food.coordinates.longitude;
        const foodLatitude = food.coordinates.latitude;

        // Calculate distance using the Haversine formula
        const distance = getDistance(
          clientLatitude,
          clientLongitude,
          foodLatitude,
          foodLongitude
        );

        return {
          ...food.toObject(),
          distance
        };
      } else {
        // If coordinates are missing, set distance to null
        return {
          ...food.toObject(),
          distance: null
        };
      }
    });

    res.status(httpStatus.OK).json(foodsWithDistance);
  } catch (error) {
    logger.error('Error in getFoodByRestaurant:', error);
    const apiError = new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      error.message || 'Error in getFoodByRestaurant'
    );
    res.status(apiError.statusCode).json({ error: apiError.message });
  }
};


const getSumAvailableFoods = Asyncly(async (req, res) => {
	try {
		const allFoods = await Food.find();
		console.log('All Foods:', allFoods);
		const sumAvailableFoods = allFoods.filter(
			(food) => food.isAvailable,
		).length;
		res.json({ sumAvailableFoods });
	} catch (error) {
		console.error('Error calculating sum of available foods:', error);
		throw new ApiError(
			httpStatus.INTERNAL_SERVER_ERROR,
			'Error calculating sum of available foods',
		);
	}
});

const getAllFoodsUnderMenu = async (req, res) => {
  try {
    const { menuId } = req.params;
    const clientLongitude = parseFloat(req.query.longitude);
    const clientLatitude = parseFloat(req.query.latitude);

    // Validate coordinates
    if (isNaN(clientLongitude) || isNaN(clientLatitude)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid coordinates');
    }

    // Find the menu document by ID
    const menu = await Menu.findById(menuId);

    if (!menu) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        'Menu not found for the specified ID'
      );
    }

    let foods;

		if (menu.name.toLowerCase() === 'all') {
      // Fetch all available foods for the restaurant associated with the menu
      foods = await Food.find({ 
        restaurant: menu.restaurant,
      })
			.populate({
				path: 'additives',
				select: 'name additives optional requiredCount ', // Populate the additives field
				
				populate: {
					path: 'additives', // Nested population to populate the additives field inside each additive
					select: 'name price ',
				}
				// Select only the necessary fields of additives
         
        })
        .populate({
          path: 'menus',
          select: 'name isAvailable'
        })
        .lean()
        .sort({ createdAt: -1 });
    } else {
      // Fetch all available foods under the specified menu
      foods = await Food.find({ menus: menuId })
        .populate({
          path: 'additives',
          select: 'name additives optional requiredCount',
          populate: {
            path: 'additives',
            select: 'name price',
          },
        })
        .populate({
          path: 'menus',
          select: 'name isAvailable',
        })
        .lean()
        .sort({ createdAt: -1 });
    }

    // Calculate the distance between client and each food item
   // Calculate the distance between client and each food item
const foodsWithDistance = await Promise.all(
  foods.map(async (food) => {
    if (
      food.coordinates &&
      food.coordinates.longitude &&
      food.coordinates.latitude
    ) {
      const foodLongitude = food.coordinates.longitude;
      const foodLatitude = food.coordinates.latitude;

      // Use the Haversine formula to calculate the distance
      const distance = getDistance(
        clientLatitude,
        clientLongitude,
        foodLatitude,
        foodLongitude
      );

      return {
        ...food,
        distance,
      };
    } else {
      // Set a default distance if coordinates are missing
      return {
        ...food,
        distance: null,
      };
    }
  })
);


    // Filter out undefined entries
    const validFoodsWithDistance = foodsWithDistance.filter((food) => food);

    res.status(httpStatus.OK).json(validFoodsWithDistance);
  } catch (error) {
    console.error('Error:', error);
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Error getting foods under the specified menu'
    );
  }
};









const getFoodtoCart = async (req, res) => {
	try {
			const foodId = req.params.id;

			// Find the food item by ID and populate the additives field
			const food = await Food.findById(foodId).populate({
					path: 'additives',
					match: { isAvailable: true }, // Filter out additives where isAvailable is false
					populate: {
							path: 'additives',
							match: { isAvailable: true }, // Filter out additives where isAvailable is false
							select: 'name price isAvailable',
					},
					select: 'name additives optional isAvailable requiredCount', // specify the fields you want to retrieve
			}).exec();

			if (!food) {
					throw new ApiError(httpStatus.NOT_FOUND, 'Food item not found');
			}

			// Filter out additive groups where additives are not available
			food.additives = food.additives.filter(group => group.additives.length > 0);

			res.status(httpStatus.OK).json(food);
	} catch (error) {
			// Handle the error
			logger.error(error);
			if (error instanceof ApiError) {
					res.status(error.statusCode).json({ status: false, message: error.message });
			} else {
					res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ status: false, message: 'Internal Server Error' });
			}
	}
};
const getFoodById = async (req, res) => {
	try {
			const foodId = req.params.id;

			// Find the food item by ID and populate the additives field
			const food = await Food.findById(foodId).populate({
					path: 'additives',
					populate: {
							path: 'additives',
							select: 'name price isAvailable',
					},
					select: 'name additives optional isAvailable requiredCount', // specify the fields you want to retrieve
			});

			if (!food) {
					throw new ApiError(httpStatus.NOT_FOUND, 'Food item not found');
			}

			res.status(httpStatus.OK).json(food);
	} catch (error) {
			// Handle the error
			logger.error(error);
			if (error instanceof ApiError) {
					res.status(error.statusCode).json({ status: false, message: error.message });
			} else {
					res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ status: false, message: 'Internal Server Error' });
			}
	}
};







const deleteFoodById = Asyncly(async (req, res) => {
	const foodId = req.params.id;
	const food = await Food.findById(foodId);
	if (!food) {
		throw new ApiError(httpStatus.NOT_FOUND, 'Food item not found');
	}
	await Food.findByIdAndDelete(foodId);
	// await Restaurant.findByIdAndUpdate(restaurantId, {
	// 	$inc: { totalItems: -1 },
	// });
	// for (const categoryId of foodToDelete.category) {
	// 	await Category.findByIdAndUpdate(categoryId, {
	// 		$inc: { numberOfItems: -1 },
	// 	});
	// }

	res
		.status(httpStatus.OK)
		.json({ status: true, message: 'Food item deleted' });
});

const foodAvailability = Asyncly(async (req, res) => {
	const foodId = req.params.id;
	const food = await Food.findById(foodId);
	if (!food) {
		throw new ApiError(httpStatus.NOT_FOUND, 'Food item not found');
	}
	food.isAvailable = !food.isAvailable;
	await food.save();
	res
		.status(httpStatus.OK)
		.json({ status: true, message: 'Food availability updated' });
});

const updateFoodById = async (req, res) => {
	const foodId = req.params.id;

	try {
			// Check if a new image is provided
			if (req.files && req.files.image) {
					const { secure_url } = await cloudinary.uploader.upload(
							req.files.image.tempFilePath,
							{
									use_filename: true,
									folder: 'FoodImage',
							}
					);

					// Update the food item with the new image URL
					req.body.image = secure_url;
			}

			// Calculate discount value if present in the request body
			let discountValue = null;
			if (req.body.discount) {
					discountValue = parseFloat(req.body.discount) / 100;
			}

			// Construct the update object from the request body
			const updateObj = { ...req.body, discount: discountValue };

			// Update the food item in the database
			const updatedFood = await Food.findByIdAndUpdate(
					foodId,
					updateObj,
					{
							new: true,
							runValidators: true,
					}
			);

			if (!updatedFood) {
					throw new ApiError(httpStatus.NOT_FOUND, 'Food item not found');
			}

			res.status(httpStatus.OK).json({
					status: true,
					message: 'Food item updated successfully',
					updatedFood,
			});
	} catch (error) {
			console.error('Error updating food item:', error);
			res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
					status: false,
					error: 'Internal server error',
			});
	}
};



const getRandomFoodByCategoryAndCode = Asyncly(async (req, res) => {
	try {
			console.log('Request received:', req.params, req.query);

			const { category } = req.params;
			const { longitude, latitude } = req.query;

			// Validate input parameters
			if (!category || !longitude || !latitude) {
					throw new Error('Category, longitude, and latitude are required');
			}

			// Convert longitude and latitude to float
			const clientLongitude = parseFloat(longitude);
			const clientLatitude = parseFloat(latitude);

			// Simplify category extraction
			const categoryId = category;

			// Location-based filter
			const filter = {
					$and: [
							{ isAvailable: true, category: categoryId },
							{ 'coordinates': { $exists: true } }
					],
			};

			// Get all foods filtered by category and location
			const foods = await Food.find(filter)
					.populate({
							path: 'restaurant',
							select: 'isActive isAvailable restaurantName',
					})	.populate({
						path: 'additives',
						select: 'name additives optional requiredCount ', // Populate the additives field
						
						populate: {
							path: 'additives', // Nested population to populate the additives field inside each additive
							select: 'name price ',
						}
						// Select only the necessary fields of additives
						 
						})
					.lean();

			// if (foods.length === 0) {
			// 		throw new Error('No food items found');
			// }

			// Calculate distance for each food
			foods.forEach((food) => {
					if (
							food.coordinates &&
							food.coordinates.longitude &&
							food.coordinates.latitude &&
							food.restaurant &&
							food.restaurant.isActive &&
							food.restaurant.isAvailable
					) {
							const foodLongitude = food.coordinates.longitude;
							const foodLatitude = food.coordinates.latitude;

							// Use the Haversine formula to calculate the distance
							const distance = getDistance(
									clientLatitude,
									clientLongitude,
									foodLatitude,
									foodLongitude,
							);

							// Add the distance to the food object
							food.distance = distance;
					} else {
							// Set a default distance if coordinates are missing or availability conditions are not met
							food.distance = null;
					}
			});

			// Filter out foods that do not meet availability conditions
			const filteredFoods = foods.filter((food) => food.distance !== null);

			// Sort the foods based on distance (ascending order)
			const sortedFoods = filteredFoods.sort(
					(a, b) => (a.distance || 0) - (b.distance || 0),
			);

			res.status(httpStatus.OK).json({ foods: sortedFoods || []});
	} catch (error) {
			console.error('Error in getRandomFoodByCategoryAndCode:', error);
			res.status(error.statusCode || httpStatus.INTERNAL_SERVER_ERROR).json({
					status: false,
					message: error.message || 'Internal Server Error',
			});
	}
});





const getTotalFoodsByRestaurant = Asyncly(async (req, res) => {
	try {
		const { restaurantId } = req.params;

		// Validate if the provided restaurantId is valid
		if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
			throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid restaurantId');
		}

		// Count the total number of foods for the specified restaurant
		const totalFoods = await Food.countDocuments({ restaurant: restaurantId });

		res.status(httpStatus.OK).json({ totalFoods });
	} catch (error) {
		logger.error(error);
		if (error instanceof ApiError) {
			res
				.status(error.statusCode)
				.json({ status: false, message: error.message });
		} else {
			res
				.status(httpStatus.INTERNAL_SERVER_ERROR)
				.json({ status: false, message: 'Internal Server Error' });
		}
	}
});
const getAllFoodsUnderMenuRestaurant = Asyncly(async (req, res) => {
  const { menuId } = req.params; // Assuming you pass the menuId in the URL parameters

  try {
    // Find the menu document by ID
    const menu = await Menu.findById(menuId);

    if (!menu) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        'Menu not found for the specified ID'
      );
    }

    let foods;
    if (menu.name.toLowerCase() === 'all') {
      // Fetch all available foods for the restaurant associated with the menu
      foods = await Food.find({ 
        restaurant: menu.restaurant,
      })
			.populate({
				path: 'additives',
				select: 'name additives optional requiredCount ', // Populate the additives field
				
				populate: {
					path: 'additives', // Nested population to populate the additives field inside each additive
					select: 'name price ',
				}
				// Select only the necessary fields of additives
         
        })
        .populate({
          path: 'menus',
          select: 'name isAvailable'
        })
        .lean()
        .sort({ createdAt: -1 });
    } else {
      // Fetch all available foods under the specified menu
      foods = await Food.find({
        menus: menuId, // Filter foods based on the provided menu ID
      })
        .populate({
          path: 'additives', // Populate the additives field
      
					populate: {
            path: 'additives', // Nested population to populate the additives field inside each additive
            select: 'name price ',
          } // Select only the necessary fields of additives
      
        })
        .populate({
          path: 'menus',
          select: 'name isAvailable'
        })
        .lean()
        .sort({ createdAt: -1 });
    }

    res.status(httpStatus.OK).json({ foods });
  } catch (error) {
    console.error('Error:', error);
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Error getting foods under the specified menu'
    );
  }
});

module.exports = {
	getAllFoodsSorted,
	getSumAvailableFoods,
	deleteDiscountAndUpdateFood,
	updateFoodPicture,
	addFood,
	getFoodById,
	getAllFoodsUnderMenu,
	getAllFoodsUnderMenuRestaurant,
	getFoodByRestaurant,
	deleteFoodById,
	foodAvailability,
	updateFoodById,
	getRandomFoodByCategoryAndCode,
	getTotalFoodsByRestaurant,
};
