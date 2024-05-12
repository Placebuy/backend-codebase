const httpStatus = require('http-status');
const Cart = require('../models/cart');
const Asyncly = require('../../utils/Asyncly');
const ApiError = require('../../utils/ApiError');
const logger = require('../../config/logger');
const Food = require('../models/food');


const addProductToCart = async (req, res) => {
	try {
		const userId = req.user.id;
		const { productId, totalPrice, additives, instructions } = req.body;

		// Fetch the product from the database to get the required additives information
		const product = await Food.findById(productId).populate('restaurant');

		// Check if the product exists
		if (!product) {
			throw new Error('Product not found');
		}

		// Fetch the restaurant ID associated with the product
		const restaurantId = product.restaurant._id;

		// Fetch existing cart items for the user
		const existingCartItems = await Cart.find({ userId });

		// Check if there is an existing cart item with the same product ID and additives
		const existingProduct = existingCartItems.find(cartItem =>
			cartItem.productId.equals(productId) &&
			(!additives || arraysEqual(cartItem.additives.map(additive => additive && additive.toString()), additives && additives.map(additive => additive && additive.toString())))
		);

		// If an existing product with the same product ID and additives is found, send a message without updating the count
		if (existingProduct) {
			return res.status(httpStatus.OK).json({ status: true, message: 'Product already exists in the cart with the same options.',productId  });
		}

		// Check if adding the new product would mix products from different restaurants
		const differentRestaurant = existingCartItems.some(cartItem =>
			cartItem.restaurantId && cartItem.restaurantId.toString() !== restaurantId.toString()
		);

		// If adding the new product would result in mixing products from different restaurants, throw an error
		if (differentRestaurant) {
			return res.status(httpStatus.BAD_REQUEST).json('Cannot add products from different restaurants cart.' );
	}
	

		// Create a new cart item with the restaurant ID
		const newCart = new Cart({
			userId: userId,
			productId: productId,
			restaurantId: restaurantId, // Store the restaurant ID
			additives: additives || [],
			quantity: 1, // Set initial quantity to 1 for new items
			totalPrice: totalPrice,
			instructions: instructions,
		});

		await newCart.save();

		// Get the updated count of items in the user's cart
		const updatedCount = await Cart.countDocuments({ userId });

		res.status(httpStatus.OK).json({ status: true, count: updatedCount, productId });
	} catch (error) {
		console.error("Error:", error);
		logger.error(error);
		if (error instanceof ApiError) {
			res.status(error.statusCode).json({ status: false, message: error.message });
		} else {
			res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ status: false, message: 'Internal Server Error' });
		}
	}
};







// Function to compare arrays
function arraysEqual(arr1, arr2) {
	if (!arr1 || !arr2 || arr1.length !== arr2.length) {
		return false;
	}
	const sortedArr1 = arr1.filter(Boolean).sort();
	const sortedArr2 = arr2.filter(Boolean).sort();
	for (let i = 0; i < sortedArr1.length; i++) {
		if (sortedArr1[i] !== sortedArr2[i]) {
			return false;
		}
	}
	return true;
}

const editCartItemAdditives = Asyncly(async (req, res) => {
	try {
		const userId = req.user.id;
		const itemId = req.params.id;
		const { additives } = req.body;

		// Fetch the cart item by ID
		const cartItem = await Cart.findById(itemId);

		if (!cartItem) {
			throw new ApiError(httpStatus.NOT_FOUND, 'Cart item not found');
		}

		// Check if the user owns the cart item
		if (!cartItem.userId.equals(userId)) {
			throw new ApiError(
				httpStatus.FORBIDDEN,
				'Unauthorized to edit this cart item',
			);
		}

		// Fetch the product from the database to validate additives
		const product = await Food.findById(cartItem.productId);

		if (!product) {
			throw new ApiError(httpStatus.NOT_FOUND, 'Product not found');
		}

		// Validate the additives against the product's available additives
		// const validAdditives = product.additives.map(additive => additive.toString());

		// if (additives.some(additive => !validAdditives.includes(additive.toString()))) {
		// 		throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid additives for the selected product');
		// }

		// Check for duplicates in the database
		const existingCartItem = await Cart.findOne({
			userId,
			productId: cartItem.productId,
			_id: { $ne: itemId }, // Exclude the current item being edited
			additives: { $all: additives },
		});

		if (existingCartItem) {
			throw new ApiError(
				httpStatus.BAD_REQUEST,
				'Duplicate cart item found with the same product and additives',
			);
		}

		// Update the cart item with the new additives
		cartItem.additives = additives || [];
		await cartItem.save();

		res.status(httpStatus.OK).json({
			status: true,
			message: 'Cart item additives updated successfully',
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

// Function to remove a product from the cart
const removeProductFromCart = Asyncly(async (req, res) => {
	const { itemId } = req.params; // Assuming itemId is the productId
	const userId = req.user.id;
	let count;

	const cartItem = await Cart.findOneAndDelete({ userId, productId: itemId });
	if (!cartItem) {
		throw new ApiError(httpStatus.NOT_FOUND, 'Cart item not found');
	}

	count = await Cart.countDocuments({ userId });
	res.status(httpStatus.OK).json({ status: true, cartCount: count });
});

const fetchUserCart = Asyncly(async (req, res) => {
	const userId = req.user.id;

	// Assuming Cart model is correctly defined
	const userCart = await Cart.find({ userId: userId })
		.populate({
			path: 'productId',
			select: 'title image restaurant discount  isAvailable',
		})
		.populate({
			path: 'additives',
			select: 'name',
		});

	// Update cart count based on availability and filter the cart items
	let updatedCount = 0;
	const filteredCart = userCart
		.map((cartItem) => {
			if (cartItem.productId && cartItem.productId.isAvailable) {
				updatedCount += 1;
				return cartItem;
			}
			return null; // Filter out unavailable items
		})
		.filter(Boolean);

	// Update the cart count in the response
	res
		.status(httpStatus.OK)
		.json({ status: true, cart: filteredCart, cartCount: updatedCount });
});

// Function to clear the user's cart
const clearUserCart = Asyncly(async (req, res) => {
	const userId = req.user.id;
	let count;

	await Cart.deleteMany({ userId: userId });
	count = await Cart.countDocuments({ userId });

	res
		.status(httpStatus.OK)
		.json({ status: true, count: count, message: 'Cart cleared' });
});

// Function to get the count of items in the user's cart
const getCartCount = Asyncly(async (req, res) => {
	const userId = req.user.id;
	const count = await Cart.countDocuments({ userId });
	res.status(httpStatus.OK).json({ status: true, cartCount: count });
});

// Function to decrement the quantity and total price of a product in the cart
const decrementProductQty = Asyncly(async (req, res) => {
	const userId = req.user.id;
	const { productId } = req.body;
	let count;

	const cartItem = await Cart.findOne({
		userId: userId,
		productId: productId,
	});
	if (!cartItem) {
		throw new ApiError(httpStatus.NOT_FOUND, 'Cart item not found');
	}

	const productPrice = cartItem.totalPrice / cartItem.quantity;
	if (cartItem.quantity > 1) {
		cartItem.quantity -= 1;
		cartItem.totalPrice -= productPrice;

		await cartItem.save();
		return res
			.status(httpStatus.OK)
			.json({ status: true, message: 'Cart item decremented successfully' });
	}
	if (cartItem.quantity === 1) {
		// If the quantity is 1, remove the product from the cart
		await Cart.findByIdAndDelete({ userId: userId, productId: productId });

		count = await Cart.countDocuments({ userId });
		return res.status(httpStatus.OK).json({ status: true, cartCount: count });
	}
});

// Function to increment the quantity and update the total price of a product in the cart
const incrementProductQty = Asyncly(async (req, res) => {
	const userId = req.user.id;
	const { productId } = req.body;

	const cartItem = await Cart.findOne({
		userId: userId,
		productId: productId,
	});

	if (!cartItem) {
		// Create a new cart item if the product is not in the cart
		const product = await Food.findById(productId); // Assuming Food is the model for products

		if (!product) {
			throw new ApiError(httpStatus.NOT_FOUND, 'Product not found');
		}

		const newCartItem = new Cart({
			userId: userId,
			productId: productId,
			quantity: 1,
			totalPrice: product.price, // Assuming price is a property in the Food model
		});

		await newCartItem.save();
		return res.json({
			status: true,
			message: 'Product added to cart successfully',
		});
	}

	// Increment the quantity and update the total price
	cartItem.quantity += 1;

	const product = await Food.findById(cartItem.productId); // Fetch the associated product
	if (!product) {
		throw new ApiError(httpStatus.NOT_FOUND, 'Product not found');
	}

	cartItem.totalPrice = cartItem.quantity * product.price; // Assuming price is a property in the Food model

	await cartItem.save();

	res.json({
		status: true,
		message: 'Cart item incremented successfully',
	});
});

module.exports = {
	addProductToCart,
	decrementProductQty,
	incrementProductQty,
	editCartItemAdditives,
	getCartCount,
	clearUserCart,
	fetchUserCart,
	removeProductFromCart,
};
