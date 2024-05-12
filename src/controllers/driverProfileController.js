/* eslint-disable import/order */
const httpStatus = require('http-status');
const { z } = require('zod');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const authValidation = require('../validation/authValidation');
const Driver = require('../models/driver');
const Order = require('../models/order');
const Restaurant = require('../models/restaurant');
const cloudinary = require('cloudinary').v2;
const {
	sendPushNotificationsToDrivers,
} = require('../helpers/pushNotification');
const Asyncly = require('../utils/Asyncly');
const ApiError = require('../utils/ApiError');
const sendEmail = require('../helpers/sendMail');
const logger = require('../config/logger');
const generateShortOrderId = require('../utils/orderUtils');

const saltRounds = 10;

const registerDriver = Asyncly(async (req, res) => {
	const driverData = authValidation.driverSchema.parse(req.body);

	try {
		// Check if there's an uploaded image
		if (!req.file) {
			return res
				.status(httpStatus.BAD_REQUEST)
				.json({ error: 'Driver image is required' });
		}

		// Upload image to Cloudinary
		const result = await cloudinary.uploader.upload(req.file.buffer, {
			folder: 'driver_images',
			allowed_formats: ['jpg', 'jpeg', 'png'],
		});

		// Add Cloudinary URL to the driver data
		driverData.imageUrl = result.secure_url;
		const existingDriverByPhone = await Driver.findOne({
			phoneNumber: driverData.phoneNumber,
		});
		const existingDriverByEmail = await Driver.findOne({
			email: driverData.email,
		});

		if (existingDriverByPhone || existingDriverByEmail) {
			return res.status(httpStatus.BAD_REQUEST).json({
				error: 'Driver with this phone number or email already exists',
			});
		}

		if (
			driverData.vehicleType === 'motorcycle' &&
			!driverData.vehiclePlateNumber
		) {
			return res
				.status(httpStatus.BAD_REQUEST)
				.json({ error: 'Vehicle plate number is required for motorcycles' });
		}

		const otpExpiration = new Date(Date.now() + 60 * 1000);
		const verificationCode = {
			code: Math.floor(1000 + Math.random() * 9000).toString(),
			expiresAt: otpExpiration,
		};

		const hashedPassword = await bcrypt.hash(driverData.password, saltRounds);

		const newDriver = new Driver({
			...driverData,
			password: hashedPassword,
			verificationCode,
			verificationCodeExpiresAt: verificationCode.expiresAt,
		});

		await newDriver.save();

		const emailContent = `Your verification code is: ${verificationCode}`;
		await sendEmail({
			to: driverData.email,
			subject: 'Email Verification',
			text: emailContent,
		});

		return res
			.status(httpStatus.CREATED)
			.json({ message: 'Driver registered successfully' });
	} catch (error) {
		logger.error('Error during registration:', error);
		return res
			.status(httpStatus.INTERNAL_SERVER_ERROR)
			.json({ error: 'Internal server error' });
	}
});

const verifyDriver = Asyncly(async (req, res) => {
	const { email, verificationCode } = req.body;

	// Find the driver by email and verification code
	const driver = await Driver.findOne({ email, verificationCode });

	if (!driver) {
		throw new ApiError(
			'Invalid verification code or email',
			httpStatus.BAD_REQUEST,
		);
	}

	// Update driver's verification status
	driver.isVerified = true;
	await driver.save();

	res.status(httpStatus.OK).json({
		message: 'Account verified successfully',
	});
});

const resendDriverVerificationCode = Asyncly(async (req, res) => {
	const { email } = req.body;

	// Find the driver by email
	const driver = await Driver.findOne({ email });

	if (!driver) {
		throw new ApiError('Driver not found', httpStatus.BAD_REQUEST);
	}

	// Generate a new verification code
	const newVerificationCode = Math.floor(
		1000 + Math.random() * 9000,
	).toString();

	// Update driver's verification code
	driver.verificationCode = newVerificationCode;
	await driver.save();

	// Send the verification code via email
	const emailContent = `Your new verification code is: ${newVerificationCode}`;
	await sendEmail({
		to: email,
		subject: 'Email Verification',
		text: emailContent,
	});

	res.status(httpStatus.OK).json({
		message: 'Verification code sent successfully',
	});
});

const getSumApprovedDrivers = Asyncly(async (req, res) => {
	try {
		const approveddrivers = await Driver.find({ approved: true });
		const sumApproveddrivers = approveddrivers.length;

		res.json({ sumApproveddrivers });
	} catch (error) {
		throw new ApiError(
			httpStatus.INTERNAL_SERVER_ERROR,
			'Error calculating sum of approved drivers',
		);
	}
});

const loginDriver = Asyncly(async (req, res) => {
	const data = authValidation.loginSchema.parse(req.body);
	const { rememberMe } = req.body;

	const driver = await Driver.findOne({ email: data.email });

	if (!driver) {
		throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid email or password');
	}

	if (!driver.approved) {
		throw new ApiError(
			httpStatus.UNAUTHORIZED,
			'Driver not approved. Please wait for approval.',
		);
	}

	const passwordMatch = await bcrypt.compare(data.password, driver.password);

	if (passwordMatch) {
		const expiresIn = rememberMe ? '30d' : process.env.DRIVER_EXPIRES_IN;

		const token = jwt.sign(
			{ id: driver._id, userType: 'Driver' },
			process.env.JWT_SECRET,
			{ expiresIn },
		);

		return res
			.status(httpStatus.OK)
			.json({ message: 'Driver login successful', token });
	}
	throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid email or password');
});

const driverForgotPassword = Asyncly(async (req, res) => {
	const email = authValidation.forgotPasswordSchema.parse(req.body);

	const driver = await Driver.findOne({ email });

	if (!driver) {
		return res.status(404).json({ success: false, message: 'Email not found' });
	}

	const resetToken = Driver.getResetPasswordToken();
	await driver.save();

	const resetUrl = `http://localhost:5173/driver/reset/password/${resetToken}`;
	const message = `
	  <h1>You have requested a password reset</h1>
	  <p>Please click the link to reset your password:</p>
	  <a href=${resetUrl} clicktracking=off>${resetUrl}</a>
  `;

	try {
		await sendEmail({
			to: email.email,
			subject: 'Password Reset Request',
			text: message,
		});

		res.status(200).json({ success: true, data: 'Email sent' });
	} catch (error) {
		await driver.save();
		return res
			.status(httpStatus.INTERNAL_SERVER_ERROR)
			.json({ success: false, message: 'Failed to send email', error });
	}
});

const driverResetPassword = Asyncly(async (req, res) => {
	const requestData = authValidation.resetPasswordSchema.parse(req.body);
	const { password } = requestData;

	const { resetToken } = req.params;
	const hashedResetToken = crypto
		.createHash('sha256')
		.update(resetToken)
		.digest('hex');

	const driver = await Driver.findOneAndUpdate(
		{
			resetPasswordToken: hashedResetToken,
			resetPasswordExpire: { $gt: Date.now() },
		},
		{
			$set: {
				password: bcrypt.hashSync(password, 10),
				resetPasswordToken: undefined,
				resetPasswordExpire: undefined,
			},
		},
		{ new: true },
	);

	if (!driver) {
		throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid reset token');
	}

	res
		.status(httpStatus.CREATED)
		.json({ success: true, message: 'Password reset successfully' });
});

const changeDriverPassword = Asyncly(async (req, res) => {
	const { driverId } = req.params;
	const passwordData = authValidation.passwordChangeSchema.parse(req.body);

	const driver = await Driver.findById(driverId);

	if (!driver) {
		throw new ApiError(httpStatus.NOT_FOUND, ' Driver not found');
	}

	const isPasswordValid = await bcrypt.compare(
		passwordData.currentPassword,
		driver.password,
	);

	if (!isPasswordValid) {
		throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid current password');
	}

	const hashedNewPassword = await bcrypt.hash(passwordData.newPassword, 10);

	driver.password = hashedNewPassword;

	await driver.save({ validateBeforeSave: false });

	res.status(httpStatus.OK).json({ message: 'Password changed successfully' });
});

const getAllDrivers = Asyncly(async (req, res) => {
	const drivers = await Driver.find();
	res.status(httpStatus.OK).json({ drivers });
});

const getSingleDriver = Asyncly(async (req, res) => {
	const { driverId } = req.params;
	const driver = await Driver.findById(driverId);

	if (!driverId) {
		throw new ApiError(httpStatus.NOT_FOUND, 'Driver not found');
	}

	res.status(httpStatus.OK).json({ driver });
});

const updateDriverProfile = Asyncly(async (req, res) => {
	const { driverId } = req.params;
	const update = req.body;
	const driver = await Driver.findByIdAndUpdate(driverId, update, {
		new: true,
	});

	if (!driverId) {
		throw new ApiError(httpStatus.NOT_FOUND, 'Driver not found');
	}

	res.status(httpStatus.OK).json({ driver });
});

const deleteDriver = Asyncly(async (req, res) => {
	const { driverId } = req.params;
	const driver = await Driver.findByIdAndDelete(driverId);

	if (!driver) {
		throw new ApiError(httpStatus.NOT_FOUND, 'Driver not found');
	}

	res.status(httpStatus.OK).json({ message: 'Driver deleted successfully' });
});

const listAssignedOrder = Asyncly(async (req, res) => {
	const { driverId } = req.params;
	try {
		// Find assigned orders for the driver with the specified driverId
		const assignedOrders = await Order.find({
			assignedDriver: driverId,
			orderStatus: 'DELIVERED',
		})
			.select('orderId orderDate orderStatus assignedDriver')
			.populate({
				path: 'assignedDriver',
				select: 'firstname lastname id',
			});

		if (!assignedOrders || assignedOrders.length === 0) {
			throw new ApiError(
				httpStatus.NOT_FOUND,
				`No assigned orders with status DELIVERED found for driver ${driverId}`,
			);
		}

		// Map the assigned orders to the desired format
		const formattedOrders = assignedOrders.map((order) => ({
			orderId: order.orderId,
			orderDate: order.orderDate,
			orderStatus: order.orderStatus,
			driver: {
				firstname: order.assignedDriver.firstname,
				lastname: order.assignedDriver.lastname,
				driverId: order.assignedDriver.id,
			},
		}));

		res.status(httpStatus.OK).json({
			data: formattedOrders,
			message: `Successfully retrieved assigned orders with status DELIVERED for driver ${assignedOrders[0].assignedDriver.firstname} ${assignedOrders[0].assignedDriver.lastname}`,
		});
	} catch (error) {
		console.error('Error retrieving assigned orders:', error);
		res
			.status(error.statusCode || httpStatus.INTERNAL_SERVER_ERROR)
			.json({ error: error.message });
	}
});

const acceptAndAssignOrder = Asyncly(async (req, res) => {
	try {
		const {  driverId } = req.params;  
		const { orderId} = req.body;  

		if (!driverId) {
			return res.status(httpStatus.UNAUTHORIZED).json({
				error: 'Driver ID is missing or not authenticated',
			});
		}

		const driver = await Driver.findById(driverId);

		if (!driver) {
			return res.status(httpStatus.NOT_FOUND).json({
				error: 'Driver not found',
			});
		}

		if (!driver.isAvailable || !driver.approved) {
			return res.status(httpStatus.BAD_REQUEST).json({
				error: 'Driver is not available or not approved for orders',
			});
		}

		const order = await Order.findById(orderId)
	
		// if (!order) {
		// 	return res.status(httpStatus.BAD_REQUEST).json({
		// 		error: 'Invalid or unavailable order for acceptance',
		// 	});
		// }

		if (order.orderStatus === 'PICK UP SOON') {
			return res.status(httpStatus.BAD_REQUEST).json({
				error: 'This order has been accepted by another Swiftdriver',
			});
		}

		order.assignedDriver = driverId;
		order.orderStatus = 'PICK UP SOON';

		await order.save();



		res.status(httpStatus.OK).json({  message: 'ACCEPTED ORDER' });
	} catch (error) {
		console.error('Error accepting and assigning order:', error);
		res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
			error: 'Error accepting and assigning order',
		});
	}
});

const updateDriverAvailability = Asyncly(async (req, res) => {
	const { driverId } = req.params;
	const driver = await Driver.findById(driverId);

	if (!driver) {
		return res.status(404).json({ status: false, message: 'Driver not found' });
	}

	driver.isAvailable = !driver.isAvailable;
	await driver.save();

	res.status(200).json({ status: true });
});

const listAvailableOrders = Asyncly(async (req, res) => {
	try {
		const orders = await Order.find({ orderStatus: 'CONFIRMED' })
			.populate({
				path: 'restaurantId',
				select: 'restaurantName address longitude latitude',
			})
			.populate({
				path: 'userId',
				select: 'firstname lastname email phoneNumber',
			})
			.populate({
				path: 'deliveryAddress',
				model: 'DynamicAddress',
			})
			.sort({ createdAt: -1 })
			.limit(20)
			.exec();

		if (!orders || orders.length === 0) {
			return res
				.status(httpStatus.NOT_FOUND)
				.json({ error: 'No available orders found' });
		}

		const processedOrders = orders.map((order) => {
			const restaurant = order.restaurantId || {};
			const user = order.userId || {};
			const deliveryAddress = order.deliveryAddress || {};

			const longitude = deliveryAddress.longitude || null;
			const latitude = deliveryAddress.latitude || null;
			return {
				orderid: order._id,
				orderId: order.orderId,
				orderDate: order.orderDate,
				restaurant: {
					name: restaurant.restaurantName || '',
					address: restaurant.address || '',
					longitude: restaurant.longitude || null,
					latitude: restaurant.latitude || null,
				},
				user: {
					name: `${user.firstname || ''} ${user.lastname || ''}`,
					email: user.email || '',
					phoneNumber: user.phoneNumber || '',
					deliveryAddress: deliveryAddress.address || '',
					longitude: longitude,
					latitude: latitude,
				},
			};
		});
		// Send push notifications to drivers
		// await sendPushNotificationsToDrivers(processedOrders);
		res.status(httpStatus.OK).json({ orders: processedOrders });
	} catch (error) {
		console.error('Error retrieving available orders:', error);
		res
			.status(httpStatus.INTERNAL_SERVER_ERROR)
			.json({ error: 'Error retrieving available orders' });
	}
});

const driverArrive = Asyncly(async (req, res) => {
	const {  driverId } = req.params;
	const { orderId } = req.body;

	const order = await Order.findById(orderId);

	if (!order) {
		throw new ApiError(httpStatus.NOT_FOUND, 'Order not found');
	}

	// if (order.orderStatus !== 'ON THE WAY') {
	// 	throw new ApiError(httpStatus.BAD_REQUEST, 'Order is not on the way');
	// }

	order.orderStatus = 'DELIVERED';
	order.assignedDriver = driverId;

	await order.save();

	res
		.status(httpStatus.OK)
		.json({ message: 'Order status updated to DELIVERED' });
});

const driverCancelOrder = Asyncly(async (req, res) => {
	const { orderId } = req.params;
	const { cancelReason } = req.body;

	// Find the order by ID
	const order = await Order.findById(orderId);

	if (!order) {
		throw new ApiError(httpStatus.NOT_FOUND, 'Order not found');
	}

	// Check if order status is 'ON THE WAY', and if it is, throw an error
	if (order.orderStatus === 'ON THE WAY') {
		throw new ApiError(
			httpStatus.BAD_REQUEST,
			'Driver cannot cancel order, it is already on the way',
		);
	}

	// Update the order status to CANCELED and set the cancelReason
	order.orderStatus = 'DECLINED';
	order.cancelReason = cancelReason;
	await order.save();

	res.status(httpStatus.OK).json({ message: 'Order canceled successfully' });
});

const totalAvailable = Asyncly(async (req, res) => {
	try {
		const confirmedOrdersCount = await Order.countDocuments({
			orderStatus: 'CONFIRMED',
		});

		console.log('Confirmed Orders Count:', confirmedOrdersCount);

		return res.status(httpStatus.OK).json({
			confirmedOrdersCount: confirmedOrdersCount,
		});
	} catch (error) {
		console.error('Error retrieving confirmed orders count:', error);
		throw new ApiError(
			httpStatus.INTERNAL_SERVER_ERROR,
			'Error retrieving confirmed orders count',
		);
	}
});
// Update Driver Document with Latitude and Longitude
const updateDriverLocation = async (driverId, latitude, longitude) => {
	try {
			const updatedDriver = await Driver.findByIdAndUpdate(
					driverId,
					{ latitude, longitude },
					{ new: true } // Return the updated document
			); 

			if (!updatedDriver) {
					throw new Error('Driver not found');
			}

			// Emit WebSocket event
			io.emit('driverLocationUpdate', { driverId, latitude, longitude });

			// You can also return the updated driver if needed
			return updatedDriver;
	} catch (error) {
			console.error('Error updating driver location:', error);
			throw error; // Propagate the error to the caller
	}
};
// app.patch('/api/v1/driver/update-driver-location/:driverId', (req, res) => {
// 	const { latitude, longitude } = req.body;
// 	const { driverId } = req.params;
// 	updateDriverLocation(driverId, latitude, longitude);
// 	res.sendStatus(200);
// });


module.exports = {
	registerDriver,
	verifyDriver,
	resendDriverVerificationCode,
	loginDriver,
	listAssignedOrder,
	getSumApprovedDrivers,
	updateDriverAvailability,
	getAllDrivers,
	getSingleDriver,
	updateDriverProfile,
	deleteDriver,
	acceptAndAssignOrder,
	changeDriverPassword,
	driverForgotPassword,
	driverResetPassword,
	driverCancelOrder,
	listAvailableOrders,
	driverArrive,
	totalAvailable,
	updateDriverLocation
};
