/* eslint-disable no-use-before-define */
const httpStatus = require('http-status');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const cloudinary = require('cloudinary').v2;
const cron = require('node-cron');
const Asyncly = require('../utils/Asyncly');
const ApiError = require('../utils/ApiError');
const Restaurant = require('../models/restaurant');
const Order = require('../models/order');
const Food = require('../models/food');
const User = require('../models/userRoleModel');
require('dotenv/config');
const authValidation = require('../validation/authValidation');
const sendEmail = require('../helpers/sendMail');
const sendPushNotification = require('../helpers/pushNotification');
const RestaurantWallet = require('../models/restaurantWallet');
const { Company, MovedSwiftTransactions } = require('../models/company'); // Ensure correct import

const registerRestaurant = async (req, res) => {
  try {
    // Extract image, password, and other data from req.body
    let { password, longitude, latitude, ...validatedData } = req.body;

    // Check if image and logo files are provided
    if (!req.files || !req.files.image) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'No image file provided');
    }
    if (!req.files || !req.files.logo) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'No logo file provided');
    }
 
    // Hash the password using bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    // Upload the image file to Cloudinary
    const { secure_url } = await cloudinary.uploader.upload(
      req.files.image.tempFilePath, 
      {
        use_filename: true,
        folder: 'RestaurantImage',
      }
    );
    const { secure_url: logo } = await cloudinary.uploader.upload(
      req.files.logo.tempFilePath, // Use req.files.logo.tempFilePath here
      {
        use_filename: true,
        folder: 'RestaurantLogo',
      }
    );

    // Add the image URL, logo URL, longitude, and latitude to the validated data
    validatedData.image = secure_url;
    validatedData.logo = logo;
    validatedData.password = hashedPassword;
    validatedData.longitude = longitude;
    validatedData.latitude = latitude;

    // Create a new restaurant instance
    const newRestaurant = new Restaurant(validatedData);

    // Save the restaurant to the database
    await newRestaurant.save();

    // Send registration confirmation email
    await sendRegistrationConfirmationEmail(validatedData.email);

    // Send success response
    res.status(httpStatus.CREATED).json({ message: 'Restaurant registered successfully' });
  } catch (error) {
    // Handle validation errors or other exceptions
    console.error(error);

    if (error.code === 11000 && error.keyPattern && error.keyPattern.email) {
      // Duplicate email error
      res.status(httpStatus.BAD_REQUEST).json({ error: 'Email already exists. Please use a different email address.' });
    } else {
      // Other errors
      res.status(httpStatus.BAD_REQUEST).json({ error: 'Invalid data provided' });
    }
  }
};
const sendRegistrationConfirmationEmail = Asyncly(async (email) => {
	const subject = 'Registration Confirmation - SwifDrop Food Delivery';
	const message = `
    <h1>Thank You for Registering with SwifDrop Food Delivery!</h1>
    <p>Your restaurant registration has been received, and we appreciate your interest in joining our platform.</p>
    <p>We are currently reviewing your application, and you will receive further instructions once it has been processed successfully.</p>
    <p>If you have any immediate questions or concerns, feel free to reach out to our support team at +2348184203201.</p>
    <p>Thank you for choosing SwifDrop Food Delivery. We look forward to the possibility of working together!</p>
  `;

	try {
		await sendEmail({
			to: email,
			subject: subject,
			text: message,
		});

		console.log(`Registration confirmation email sent to: ${email}`);
	} catch (error) {
		console.error(
			'Error sending registration confirmation email:',
			error.message,
		);
	}
});






const updateProfilePicture = Asyncly(async (req, res) => {
	// Assuming the restaurant ID is passed in the request params
	const { restaurantId } = req.params;

	// Check if a new profile picture is uploaded
	if (!req.files || !req.files.image) {
		throw new ApiError(httpStatus.BAD_REQUEST, 'No image file provided');
	}

	// Find the restaurant by ID
	let restaurant = await Restaurant.findById(restaurantId);

	if (!restaurant) {
		throw new ApiError(httpStatus.NOT_FOUND, 'Restaurant not found');
	}

	// Upload the new profile picture to Cloudinary
	const { secure_url } = await cloudinary.uploader.upload(
		req.files.image.tempFilePath,
		{
			use_filename: true,
			folder: 'RestaurantImage',
		},
	);

	// Update the restaurant's profile picture
	restaurant = await Restaurant.findByIdAndUpdate(
		restaurantId,
		{ image: secure_url },
		{ new: true },
	);

	res
		.status(httpStatus.OK)
		.json({ message: 'Profile picture updated successfully' });
});



const loginRestaurant = Asyncly(async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;

    // Find the restaurant by the email
    const restaurant = await Restaurant.findOne({ email });

    if (!restaurant) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Restaurant not found');
    }

    // Compare passwords
    const isPasswordValid = await bcrypt.compare(
      password,
      restaurant.password
    );

    if (!isPasswordValid) {
      console.error('Invalid password for email:', email);
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid email or password');
    }

    if (!restaurant.approved) {
      throw new ApiError(
        httpStatus.UNAUTHORIZED,
        'Restaurant not approved. Please wait for approval.'
      );
    }

    const tokenExpiration = rememberMe ? '30d' : '10d';
    const token = jwt.sign(
      { id: restaurant._id, userType: 'Restaurant' },
      process.env.JWT_SECRET,
      { expiresIn: tokenExpiration }
    );

    // Update the rememberMe field
    await Restaurant.findByIdAndUpdate(restaurant._id, { rememberMe });

    // Remove sensitive fields from the restaurant object
    const restaurantWithoutSensitiveInfo = {
      ...restaurant.toObject(),
      password: undefined, // Exclude password
      businessLicense: undefined, // Exclude business license
    };

    res.status(httpStatus.OK).json({
      message: 'Login successful',
      token,
      restaurant: restaurantWithoutSensitiveInfo,
    });
  } catch (error) {
    console.error('Error during login:', error);
    res
      .status(error.statusCode || httpStatus.UNAUTHORIZED)
      .json({ error: error.message || 'Invalid email or password' });
  }
});









const serviceAvailability = Asyncly(async (req, res) => {
	const restaurantId = req.params.id;

	// Find the restaurant by ID
	const restaurant = await Restaurant.findById(restaurantId);

	if (!restaurant) {
		throw new ApiError(httpStatus.FORBIDDEN, 'Restaurant not found');
	}

	if (!restaurant.isActive) {
		throw new ApiError(httpStatus.UNAUTHORIZED, 'Restaurant is suspended');
	}

	// Toggle the availability of the restaurant
	restaurant.isAvailable = !restaurant.isAvailable;
	await restaurant.save();

	res.status(httpStatus.OK).json({
		message: 'Availability successfully toggled',
		isAvailable: restaurant.isAvailable,
	});
});

const getSumApprovedRestaurants = Asyncly(async (req, res) => {
	try {
		// Find all approved restaurants
		const approvedRestaurants = await Restaurant.find({ approved: true });

		// Calculate the sum of approved restaurants
		const sumApprovedRestaurants = approvedRestaurants.length;

		res.json({ sumApprovedRestaurants });
	} catch (error) {
		throw new ApiError(
			httpStatus.INTERNAL_SERVER_ERROR,
			'Error calculating sum of approved restaurants',
		);
	}
});

const getRestaurant = Asyncly(async (req, res) => {
	const restaurant = await Restaurant.findById(req.params.id);
	res.json({ restaurant });
});

const getAllRestaurants = Asyncly(async (req, res) => {
	const restaurants = await Restaurant.find();
	res.status(httpStatus.OK).json({ restaurants });
});

const updateRestaurant = async (req, res) => {
	try {
		const updatedRestaurant = await Restaurant.findOneAndUpdate(
			{ _id: req.params.id },
			{ $set: req.body },
			{ new: true },
		);

		if (!updatedRestaurant) {
			return res.status(404).json({ message: 'Restaurant not found' });
		}

		res.json({
			message: 'Restaurant updated successfully',
			restaurant: updatedRestaurant,
		});
	} catch (error) {
		console.error('Error updating restaurant:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
};

const deleteRestaurant = Asyncly(async (req, res) => {
	await Restaurant.findByIdAndDelete(req.params.id);
	res.json({ message: 'Restaurant deleted successfully' });
});
const getAllRestaurantsSorted = Asyncly(async (req, res) => {
  const clientLongitude = parseFloat(req.query.longitude);
  const clientLatitude = parseFloat(req.query.latitude);

  // eslint-disable-next-line no-restricted-globals
  if (isNaN(clientLongitude) || isNaN(clientLatitude)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid coordinates');
  }



  try {
    // Find all approved restaurants
    const approvedRestaurants = await Restaurant.find({
      approved: true,
      isActive: true,
    });

  

    // Calculate the distance between the client and each restaurant
    const restaurantsWithDistance = approvedRestaurants.map((restaurant) => {
      if (
        restaurant.longitude !== undefined &&
        restaurant.latitude !== undefined &&
        restaurant.longitude !== null &&
        restaurant.latitude !== null
      ) {
        // New schema with separate longitude and latitude fields
        const distance = getDistance(
          clientLatitude,
          clientLongitude,
          restaurant.latitude,
          restaurant.longitude
        );

        return { ...restaurant.toObject(), distance };
      } else {
        // Restaurant doesn't have valid coordinates, skip it
        // console.log('Skipping Restaurant:', restaurant.toObject());
        return { ...restaurant.toObject(), distance: null };
      }
    });

    // Sort the restaurants based on distance (ascending order)
    const sortedRestaurants = restaurantsWithDistance
      .filter((restaurant) => restaurant.distance !== null && restaurant.distance !== undefined)
      .sort((a, b) => a.distance - b.distance);

    // console.log('Sorted Restaurants:', sortedRestaurants);

    res.status(httpStatus.OK).json({ restaurants: sortedRestaurants });
  } catch (error) {
    console.error('Error:', error);
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Error getting and sorting approved restaurants',
    );
  }
});


// Haversine formula to calculate the distance between two points on the Earth's surface
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = deg2rad(lat2 - lat1);
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

const getRandomRestaurant = Asyncly(async (req, res) => {
	let randomRestaurant = [];

	if (req.params.code) {
		randomRestaurant = await Restaurant.aggregate([
			{ $match: { code: req.params.code } },
			{ $sample: { size: 1 } },
			{ $project: { __v: 0 } },
		]);
	}

	if (!randomRestaurant.length) {
		randomRestaurant = await Restaurant.aggregate([
			{ $sample: { size: 1 } },
			{ $project: { __v: 0 } },
		]);
	}

	res.status(httpStatus.OK).json(randomRestaurant);
});

const declineOrder = Asyncly(async (req, res) => {
	try {
			const { orderId } = req.params;

			const order = await Order.findOneAndUpdate(
					{ _id: orderId },
					{ $set: { orderStatus: 'DECLINED' } },
					{ new: true }
			).populate({
					path: 'userId',
					select: 'email', // Only select the email field
			});

			if (!order) {
					throw new ApiError(httpStatus.NOT_FOUND, 'Order not found');
			}

			// Additional logic for refunding to the user's wallet
			// const amountToRefund = order.grandTotal;
			// order.userId.wallet.balance += amountToRefund;
			// await order.userId.save();

			// Send email notification to the user
			const userEmail = order.userId.email;
			const emailSubject = 'Order Cancellation Notification';
			const emailMessage = `
					<p>Sorry, your order with ID ${order.orderId} has been cancelled.</p>
					<p>We have refunded the amount to your wallet.</p>
					<p>We apologize for any inconvenience caused.</p>
					<p>Thank you for your understanding.</p>
			`;
			console.log('User Email:', userEmail);
			await sendEmail({ to: userEmail, subject: emailSubject, text: emailMessage });

			// Additional logic for sending push notification to the user
			// if (order.userId && order.userId.fcmToken) {
			//     const notification = {
			//         title: 'Order Declined',
			//         body: 'Your order has been declined. Check your wallet balance for any refunds.',
			//     };
			//     const pushNotification = await sendPushNotification(order.userId.fcmToken, notification);
			// }

			res.status(httpStatus.OK).json({ message: 'Order declined successfully' });
	} catch (error) {
			console.error('Error in declineOrder:', error);
			res.status(error.statusCode || httpStatus.INTERNAL_SERVER_ERROR).json({
					status: false,
					message: error.message || 'Internal Server Error',
			});
	}
});






const confirmOrder = Asyncly(async (req, res) => {
	const { orderId } = req.params;

	const order = await Order.findOne({ _id: orderId })
															.populate('restaurantId')
															.populate('userId');

	if (!order) {
			throw new ApiError(httpStatus.NOT_FOUND, 'Order not found');
	}

	if (order.paymentStatus !== 'Completed') {
			return res.status(httpStatus.BAD_REQUEST).json({
					error: 'The order cannot be confirmed because payment has not been completed. Please ensure that the payment for this order has been successfully processed before confirming it.'
			});
	}

	order.orderStatus = 'CONFIRMED';
	await order.save();

	let restaurantName = ''; // Default to an empty string if restaurantName is not available
	if (order.restaurantId) {
			restaurantName = order.restaurantId.restaurantName || ''; // Use restaurantName if available, otherwise default to an empty string
	}

	if (order.userId && order.userId.fcmToken) {
			const notification = {
					title: 'Your order has been confirmed!',
					body: restaurantName ? `Your order from ${restaurantName} has been confirmed. You can expect your meal soon` : 'Your order has been confirmed. You can expect your meal soon',
			};
			const pushNotification = await sendPushNotification(
					order.userId.fcmToken,
					notification,
			);
	}

	res.status(httpStatus.OK).json({ message: 'Order confirmed successfully' });
});


const dispatchOrder = Asyncly(async (req, res) => {
	const { orderId } = req.params;

	const order = await Order.findById({ _id: orderId })

	if (!order) {
			throw new ApiError(httpStatus.NOT_FOUND, 'Order not found');
	}

	if (order.orderStatus === 'ON THE WAY') {
			throw new ApiError(httpStatus.BAD_REQUEST, 'Order has already been dispatched');
	}

	if (order.orderStatus !== 'PICK UP SOON') {
			// Set order status to 'PICK UP SOON' if it's not already set
			order.orderStatus = 'PICK UP SOON';
	}

	// Proceed to update the order status to 'ON THE WAY' and save
	order.orderStatus = 'ON THE WAY';
	await order.save();

	// Retrieve the restaurant associated with the order
	const restaurant = await Restaurant.findById(order.restaurantId);

	// Retrieve the restaurant wallet associated with the restaurant
	const restaurantWallet = await RestaurantWallet.findOne({ restaurant: restaurant._id });

	// Add the order's total to the restaurant wallet's swift wallet
	restaurantWallet.swiftWallet += order.orderTotal;

	// Save the updated swift wallet balance for the restaurant wallet
	await restaurantWallet.save();

	const company = await Company.findOne(); // Assuming there's only one company document
	if (company) {
			company.pendingRestauransbal += order.orderTotal; // Add order total to pending restaurant balance
			company.totalSwiftBal += order.orderTotal; // Add order total to pending restaurant balance
			await company.save();
	}

	res.status(httpStatus.OK).json({ message: 'Order dispatched successfully' });
});


const forgotPasswordRestaurant = Asyncly(async (req, res) => {
	const passwordData = authValidation.forgotPasswordSchema.parse(req.body);
	const { email } = passwordData;

	try {
		const restaurant = await Restaurant.findOne({ email });
		if (!restaurant) {
			return res
				.status(httpStatus.NOT_FOUND)
				.json({ success: false, message: 'Email not found' });
		}

		const resetToken = restaurant.getResetPasswordToken();
		await restaurant.save();

		const resetUrl = `https://new-swift.vercel.app/resetpassword/${resetToken}`;
		const message = `<h1>You have requested a password reset</h1><p>Please go to the link to reset your password:</p><a href=${resetUrl} clicktracking="off">${resetUrl}</a>`;

		try {
			await sendEmail({
				to: restaurant.email,
				subject: 'Password Reset Request',
				text: message,
			});
			res.status(httpStatus.OK).json({ success: true, data: 'Email sent' });
		} catch (error) {
			restaurant.resetPasswordToken = undefined;
			restaurant.resetPasswordExpire = undefined;
			await restaurant.save();
			return res
				.status(httpStatus.INTERNAL_SERVER_ERROR)
				.json({ message: "Email couldn't be sent", error });
		}
	} catch (error) {
		res
			.status(httpStatus.INTERNAL_SERVER_ERROR)
			.json({ success: false, message: error.message });
	}
});

const resetPasswordRestaurant = Asyncly(async (req, res) => {
	const resetPasswordData = authValidation.resetPasswordSchema.parse(req.body);
	const { password } = resetPasswordData;

	const resetPasswordToken = crypto
		.createHash('sha256')
		.update(req.params.resetToken)
		.digest('hex');
``
	try {
		const foundRestaurant = await Restaurant.findOne({
			resetPasswordToken,
			resetPasswordExpire: { $gt: Date.now() },
		});

		if (!foundRestaurant) {
			return res
				.status(httpStatus.BAD_REQUEST)
				.json({ success: false, message: 'Invalid reset token' });
		}

		foundRestaurant.password = bcrypt.hashSync(password, 10);
		foundRestaurant.resetPasswordToken = undefined;
		foundRestaurant.resetPasswordExpire = undefined;

		await foundRestaurant.save();

		res
			.status(httpStatus.CREATED)
			.json({ success: true, message: 'Password reset successfully' });
	} catch (error) {
		res
			.status(httpStatus.INTERNAL_SERVER_ERROR)
			.json({ success: false, message: error.message });
	}
});

const changePasswordRestaurant = Asyncly(async (req, res) => {
	const { restaurantId } = req.params;

	const passwordData = authValidation.passwordChangeSchema.parse(req.body);

	try {
		const restaurant = await Restaurant.findById(restaurantId);

		if (!restaurant) {
			throw new ApiError(httpStatus.NOT_FOUND, 'Restaurant not found');
		}

		const isPasswordValid = await bcrypt.compare(
			passwordData.currentPassword,
			restaurant.password,
		);

		if (!isPasswordValid) {
			throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid current password');
		}

		const hashedNewPassword = await bcrypt.hash(passwordData.newPassword, 10);

		restaurant.password = hashedNewPassword;

		await restaurant.save({ validateBeforeSave: false });

		res
			.status(httpStatus.OK)
			.json({ message: 'Password changed successfully' });
	} catch (error) {
		res
			.status(httpStatus.INTERNAL_SERVER_ERROR)
			.json({ message: error.message });
		throw new ApiError(
			httpStatus.INTERNAL_SERVER_ERROR,
			'Error changing password',
		);
	}
});


const totalPending = Asyncly(async (req, res) => {
	try {
			const { restaurantId } = req.params;

			// Get the start and end of the current day
			// const startOfDay = new Date();
			// startOfDay.setHours(0, 0, 0, 0);
			// const endOfDay = new Date();
			// endOfDay.setHours(23, 59, 59, 999);

			const totalPendingOrders = await Order.countDocuments({
					restaurantId,
					orderStatus: 'PENDING',
					paymentStatus: 'Completed'
					// orderDate: { $gte: startOfDay, $lte: endOfDay }
			});

			res.json({ totalPendingOrders });
	} catch (error) {
			res.status(500).json({ error: error.message });
	}
});


const totalConfirmed = Asyncly(async (req, res) => {
	const { restaurantId } = req.params;




	const totalConfirmedOrders = await Order.countDocuments({
			restaurantId,
			orderStatus: 'CONFIRMED',
			paymentStatus: 'Completed',
	
	});

	res.json({ totalConfirmedOrders });
});
const totalDispatched = Asyncly(async (req, res) => {
  try {
    const { restaurantId } = req.params;

    // Find the latest order date for pending orders with confirmed payment status
    const latestPendingOrder = await Order.findOne({
      restaurantId,
      orderStatus: 'PENDING',
      paymentStatus: 'Completed'
    }).sort({ orderDate: -1 }); // Sort in descending order to get the latest order first

    // If there are no pending orders with confirmed payment status, return 0
    if (!latestPendingOrder) {
      return res.json({ totalDispatchedOrders: 0 });
    }

    // Use the latest pending order date to filter delivered orders
    const totalDeliveredOrders = await Order.countDocuments({
      restaurantId,
      orderStatus: 'DELIVERED',
      orderDate: latestPendingOrder.orderDate // Filter by the latest pending order date
    });

    // Count the total number of orders on the way
    const totalOnTheWayOrders = await Order.countDocuments({
      restaurantId,
      orderStatus: 'ON THE WAY'
    });

    // Calculate the total dispatched orders
    const totalDispatchedOrders = totalDeliveredOrders + totalOnTheWayOrders;

    res.json({ totalDispatchedOrders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});




const totalDelivered = Asyncly(async (req, res) => {
	try {
			const { restaurantId } = req.params;
 
			// Get the start and end of the current day
			const startOfDay = new Date();
			startOfDay.setHours(0, 0, 0, 0);
			const endOfDay = new Date();
			endOfDay.setHours(23, 59, 59, 999);

			const totalDeliveredOrders = await Order.countDocuments({
					restaurantId,
					orderStatus: 'DELIVERED',
					orderDate: { $gte: startOfDay, $lte: endOfDay }
			});

			res.json({ totalDeliveredOrders });
	} catch (error) {
			res.status(500).json({ error: error.message });
	}
});
const totalOntheway = Asyncly(async (req, res) => {
	try {
			const { restaurantId } = req.params;

			const totalOnthewayOrders = await Order.countDocuments({
					restaurantId,
					orderStatus: 'ON THE WAY',
			});

			res.json({ totalOnthewayOrders });
	} catch (error) {
			res.status(500).json({ error: error.message });
	}
});



const changePasswordWithoutCurrent = Asyncly(async (req, res) => {
 
  const { restaurantId } = req.params;
  const { newPassword } = req.body;

  try {
    const restaurant = await Restaurant.findById(restaurantId);

    if (!restaurant) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Restaurant not found');
    }

    // Hash the new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update the restaurant's password
    restaurant.password = hashedNewPassword;

    // Save the changes to the restaurant
    await restaurant.save({ validateBeforeSave: false });

    res.status(httpStatus.OK).json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Error changing password' });
  }
});



// cron.schedule('*/10 * * * * *', () => {
// 	console.log('Logging to the console every 10 seconds:', new Date());
// });






//const deg2rad = (deg) => deg * (Math.PI / 180);

module.exports = {
	getRestaurant,
	getAllRestaurantsSorted,
	getSumApprovedRestaurants,
	updateRestaurant,
	updateProfilePicture,
	deleteRestaurant,
	registerRestaurant,
	getRandomRestaurant,
	serviceAvailability,
	loginRestaurant,
	getAllRestaurants,
	confirmOrder,
	declineOrder,
	forgotPasswordRestaurant,
	resetPasswordRestaurant,
	changePasswordRestaurant,
	changePasswordWithoutCurrent,
	dispatchOrder,
	totalPending,
	totalConfirmed,
	totalDispatched,
	totalDelivered,
	totalOntheway,
	
};
