/* eslint-disable camelcase */
const httpStatus = require('http-status');
const { exceptions } = require('winston');
const Asyncly = require('../utils/Asyncly');
const ApiError = require('../utils/ApiError');
const User = require('../models/userRoleModel');
const updateValidation = require('../validation/updateValidation');
const logger = require('../config/logger');
// eslint-disable-next-line import/order
const cloudinary = require('cloudinary').v2;
const axios = require('axios');
require('dotenv').config();

const apiKey = "sk_live_650358adbc6492408bc95efe5d13a932c8ab7282";

const mongoose = require('mongoose');




const getAllUsers = Asyncly(async (req, res) => {
	const users = await User.find();
	res.json(users);
});
const getCustomerDedicatedVirtualAccount = async (req, res) => {
	try {
		const {userId} = req.params;
		const user = await User.findById(userId);

		const { email } = user;
		const url = `https://api.paystack.co/customer/${email}`;   

		const headers = {
			Authorization: `Bearer ${apiKey}`,
		};

		const response = await axios.get(url, { headers });

		const responseData = response.data;

		if (!responseData || responseData.status !== true) {
			return res
				.status(httpStatus.NOT_FOUND)
				.json({ message: `Error retrieving user Dedicated Virtual Account` });
		}

		const dva = await User.findOneAndUpdate(
			{ email },
			{
				$set: {
					'wallet.accountNumber':
						responseData.data.dedicated_account.account_number,
					'wallet.accountName':
						responseData.data.dedicated_account.account_name,
					'wallet.bankName': responseData.data.dedicated_account.bank.name,
				},
			},
			{
				new: true,
			},
		);

		return res.status(httpStatus.OK).json({ data: dva });
	} catch (err) {
		logger.error(`Failed to fetch customer Virtual account details ${err}`); 
		return res
			.status(httpStatus.INTERNAL_SERVER_ERROR)
			.json({ error: 'An error occured' });
	}
};

// Get user profile
const getUserProfile = Asyncly(async (req, res) => {
	const { userId } = req.params;

	const user = await User.findById(userId);
	if (!user) {
		throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
	}

	res.json({ user });
});
const getUserProfileWithDVA = async (req, res) => {
	await getCustomerDedicatedVirtualAccount(req, res); // Run getCustomerDedicatedVirtualAccount middleware
	await getUserProfile(req, res); // Continue with getUserProfile
};

// Define the middleware to run before getUserProfile
const getUserProfileMiddleware = async (req, res, next) => {   
	try {
			await getUserProfileWithDVA(req, res);
	} catch (err) {
			next(err);
	}
};

const updateProfilePicture = Asyncly(async (req, res) => {
	const { userId } = req.params;

	// Check if a new profile picture is uploaded
	if (!req.files || !req.files.image) {
		throw new ApiError(httpStatus.BAD_REQUEST, 'No image file provided');
	}

	try {
		// Upload the new image to Cloudinary
		const { secure_url } = await cloudinary.uploader.upload(
			req.files.image.tempFilePath,
			{
				use_filename: true,
				folder: 'Client Image',
			},
		);

		// Update the user's profile picture
		const updatedUser = await User.findByIdAndUpdate(
			userId,
			{ image: secure_url },
			{ new: true },
		);

		res.json({
			message: 'Profile picture updated successfully',
			user: updatedUser,
		});
	} catch (error) {
		console.error('Error updating profile picture:', error);
		throw new ApiError(
			httpStatus.INTERNAL_SERVER_ERROR,
			'Error updating profile picture',
		);
	}
});

// Update user profile
const updateUserProfile = Asyncly(async (req, res) => {
	const { userId } = req.params;
	const validatedData = updateValidation.updateUserSchema.parse(req.body);

	const updatedUser = await User.findByIdAndUpdate(
		userId,
		{
			username: validatedData.firstname,
			firstname: validatedData.firstname,
		},
		{ new: true },
	);

	if (!updatedUser) {
		throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
	}

	res.json({ message: 'User profile updated successfully', user: updatedUser });
});

const getSumVerifiedUsers = Asyncly(async (req, res) => {
	try {
		// Find all verified users
		const verifiedUsers = await User.find({ isVerified: true });

		// Calculate the sum of verified users
		const sumVerifiedUsers = verifiedUsers.length;

		res.json({ sumVerifiedUsers });
	} catch (error) {
		throw new ApiError(
			httpStatus.INTERNAL_SERVER_ERROR,
			'Error calculating sum of verified users',
		);
	}
});

// Delete user profile
const deleteUserProfile = Asyncly(async (req, res) => {
	const { userId } = req.params;
	const user = await User.findByIdAndDelete(userId);
	res.json({ message: 'User profile deleted successfully' });

	if (!user) {
		return next(new ApiError(httpStatus.NOT_FOUND, 'user not found'));
	}
});

const getUserWalletDetails = async (req, res) => {
	try {
		const userId = req.user.id;
		const user = await User.findById(userId);
		if (!user) {
			return res.status(httpStatus.NOT_FOUND).json({ error: 'User not found' });
		}
		const walletDetails = user.wallet;
		return res.status(httpStatus.OK).json({ data: walletDetails });
	} catch (err) {
		logger.error(`An error occurred! ${err}`);
		return res
			.status(httpStatus.INTERNAL_SERVER_ERROR)
			.json({ error: `An error occurred` });
	}
};

module.exports = {
	getSumVerifiedUsers,
	getUserProfile,
	updateUserProfile,
	deleteUserProfile,
	getAllUsers,
	updateProfilePicture,
	getUserWalletDetails,
	getCustomerDedicatedVirtualAccount,
	getUserProfileMiddleware
};
