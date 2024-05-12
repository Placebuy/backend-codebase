/* eslint-disable camelcase */
/* eslint-disable no-use-before-define */
const httpStatus = require('http-status');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const cloudinary = require('cloudinary').v2;
const Asyncly = require('../utils/Asyncly');
const ApiError = require('../utils/ApiError');
const SuperAdmin = require('../models/superAdmin');
const Driver = require('../models/driver');
const Restaurant = require('../models/restaurant');
const User = require('../models/userRoleModel');
const authValidation = require('../validation/authValidation');
const adminValidation = require('../validation/adminValidation');
const Food = require('../models/food');
require('dotenv/config');
const sendEmail = require('../helpers/sendMail');
const RestaurantWallet = require('../models/restaurantWallet');

const registerSuperAdmin = Asyncly(async (req, res) => {
	const validatedData = authValidation.superAdminSchema.parse(req.body);

	// eslint-disable-next-line no-undef
	const { token } = req.body;
	const isValidToken = token === process.env.SUPERADMIN_PASS;

	if (!isValidToken) {
		throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid registration token');
	}

	// Check if Super Admin already exists
	const existingSuperAdmin = await SuperAdmin.findOne({
		email: validatedData.email,
	});

	if (existingSuperAdmin) {
		throw new ApiError(httpStatus.CONFLICT, 'Super Admin already exists');
	}

	// Hash password
	const hashedPassword = await bcrypt.hash(validatedData.password, 10);

	// Create new Super Admin
	const newSuperAdmin = new SuperAdmin({
		...validatedData,
		password: hashedPassword,
	});

	// Save new Super Admin to the database
	await newSuperAdmin.save();

	// Respond with success message
	res
		.status(httpStatus.OK)
		.json({ message: 'Super Admin registered successfully' });
});




const loginSuperAdmin = Asyncly(async (req, res) => {
	const loginData = authValidation.loginSchema.parse(req.body);

	const superAdmin = await SuperAdmin.findOne({ email: loginData.email });

	if (!superAdmin) {
		throw new ApiError(httpStatus.NOT_FOUND, 'SuperAdmin not found');
	}

	const isValidPassword = await bcrypt.compare(
		loginData.password,
		superAdmin.password,
	);

	if (!isValidPassword) {
		throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid email or password');
	}

	const loginToken = jwt.sign(
		{ id: superAdmin._id, userType: 'SuperAdmin' },
		process.env.JWT_SECRET,
		{ expiresIn: process.env.SUPER_ADMIN_EXPIRES_IN },
	);

	res
		.status(httpStatus.OK)
		.json({ message: 'Login successful', token: loginToken });
});

const getSuperAdmin = Asyncly(async (req, res) => {
	const { superAdminId } = req.params;
	const superAdmin = await SuperAdmin.findById(superAdminId);

	if (!superAdmin) {
		throw new ApiError(httpStatus.NOT_FOUND, 'Super Admin not found');
	}

	res.status(httpStatus.OK).json({ superAdmin });
});

const getAllSuperAdmins = Asyncly(async (req, res) => {
	const allSuperAdmins = await SuperAdmin.find({});

	res.status(httpStatus.OK).json({ allSuperAdmins });
});

const editSuperAdmin = Asyncly(async (req, res) => {
	const { superAdminId } = req.params;

	const validatedData = adminValidation.editAdminSchema.parse(req.body);

	const updatedSuperAdmin = await SuperAdmin.findByIdAndUpdate(
		superAdminId,
		validatedData,
		{ new: true },
	);

	if (!updatedSuperAdmin) {
		throw new ApiError(httpStatus.NOT_FOUND, 'Super Admin not found');
	}

	res
		.status(httpStatus.OK)
		.json({ message: 'Super Admin updated successfully', updatedSuperAdmin });
});

const changePassword = Asyncly(async (req, res) => {
	const { superAdminId } = req.params;

	const passwordData = authValidation.passwordChangeSchema.parse(req.body);
	const superAdmin = await SuperAdmin.findById(superAdminId);

	if (!superAdmin) {
		throw new ApiError(httpStatus.NOT_FOUND, 'Super Admin not found');
	}

	const isPasswordValid = await bcrypt.compare(
		passwordData.currentPassword,
		superAdmin.password,
	);

	if (!isPasswordValid) {
		throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid current password');
	}

	const hashedNewPassword = await bcrypt.hash(passwordData.newPassword, 10);
	superAdmin.password = hashedNewPassword;

	await superAdmin.save({ validateBeforeSave: false });

	res.status(httpStatus.OK).json({ message: 'Password changed successfully' });

	throw new ApiError(
		httpStatus.INTERNAL_SERVER_ERROR,
		'Error changing password',
	);
});
const superAdminForgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const superAdmin = await SuperAdmin.findOne({ email });

    if (!superAdmin) {
      return res.status(404).json({ success: false, message: 'Email not found' });
    }

    const resetToken = superAdmin.getResetPasswordToken();
    await superAdmin.save();

    const resetUrl = `http://localhost:5173/password/${resetToken}`;
    const message = `
      <h1>You have requested a password reset</h1>
      <p>Please click the link to reset your password:</p>
      <a href=${resetUrl} clicktracking=off>${resetUrl}</a>
    `;

    try {
      await sendEmail({
        to: email,
        subject: 'Password Reset Request',
        text: message,
      });

      res.status(httpStatus.OK).json({ success: true, data: 'Email sent' });
    } catch (error) {
      // Reset token and expiration if email couldn't be sent (optional)
      superAdmin.resetPasswordToken = undefined;
      superAdmin.resetPasswordExpire = undefined;
      await superAdmin.save();

      return res
        .status(httpStatus.INTERNAL_SERVER_ERROR)
        .json({ success: false, message: "Email couldn't be sent", error });
    }
  } catch (error) {
    return res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: 'Failed to send email', error });
  }
};

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

		const resetUrl = `http://localhost:5173/password/${resetToken}`;
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


const superAdminResetPassword = Asyncly(async (req, res) => {
	const requestData = authValidation.resetPasswordSchema.parse(req.body);
	const { password } = requestData;

	const { resetToken } = req.params;
	const hashedResetToken = crypto
		.createHash('sha256')
		.update(resetToken)
		.digest('hex');

	const superAdmin = await superAdmin.findOneAndUpdate(
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

	if (!superAdmin) {
		throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid reset token');
	}

	res
		.status(httpStatus.CREATED)
		.json({ success: true, message: 'Password reset successfully' });
});

const updateProfilePictureSuperAdmin = Asyncly(async (req, res) => {
	const { superAdminId } = req.params;

	// Check if a new profile picture is uploaded
	if (!req.files || !req.files.image) {
		throw new ApiError(httpStatus.BAD_REQUEST, 'No image file provided');
	}

	// Upload the new image to Cloudinary
	const { secure_url } = await cloudinary.uploader.upload(
		req.files.image.tempFilePath,
		{
			use_filename: true,
			folder: 'SuperAdminProfileImage',
		},
	);

	// Update the user's profile picture
	const updatedUser = await SuperAdmin.findByIdAndUpdate(
		superAdminId,
		{ image: secure_url },
		{ new: true },
	);

	res.json({
		message: 'Profile picture updated successfully',
		user: updatedUser,
	});
});

const approveRestaurant = Asyncly(async (req, res) => {
  const { restaurantId } = req.params;

  try {
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Restaurant not found');
    }

    // if (restaurant.approved !== false) {
    //   throw new ApiError(
    //     httpStatus.BAD_REQUEST,
    //     'Restaurant is already approved',
    //   );
    // }

    // Update the restaurant approval status
    await Restaurant.findByIdAndUpdate(restaurantId, { approved: true });
		const existingWallet = await RestaurantWallet.findOne({ restaurant: restaurantId });
    if (!existingWallet) {
      await RestaurantWallet.create({ restaurant: restaurantId });
    }

    // Send the approval confirmation email to the restaurant
    const subject = 'Restaurant Approval - SwifDrop Food Delivery';
    const approvalMessage = `
      <h1>Congratulations! Your Restaurant is Approved!</h1>
      <p>Your restaurant registration with SwifDrop Food Delivery has been approved.</p>
      <p>You can now log in to your restaurant dashboard to manage your menu, orders, and more.</p>
      <p>Use the following link to log in: <a href="https://new-swift.vercel.app/">Restaurant Dashboard Login</a></p>
      <p>If you have any questions or need assistance, feel free to contact our support team at +2348184203201.</p>
      <p>Thank you for choosing SwifDrop Food Delivery. We wish you success on our platform!</p>
    `;

    await sendEmail({
      to: restaurant.email, // Assuming the restaurant email is stored in the 'email' field
      subject: subject,
      text: approvalMessage,
    });

    res
      .status(httpStatus.OK)
      .json({ message: 'Restaurant successfully approved' });
  } catch (error) {
    console.error('Error approving restaurant:', error.message);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Internal server error' });
  }
});


const approveDriver = Asyncly(async (req, res) => {
	const { driverId } = req.params;
	const driver = await Driver.findById(driverId);
	if (!driver) {
		throw new ApiError(httpStatus.NOT_FOUND, 'Driver not found');
	}

	if (driver.approved !== false) {
		throw new ApiError(httpStatus.BAD_REQUEST, 'Driver is already approved');
	}

	await Driver.findByIdAndUpdate(driverId, { approved: true });

	res.status(httpStatus.OK).json({ message: 'Driver successfully approved' });
});

const deleteSuperAdmin = Asyncly(async (req, res) => {
	const { superAdminId } = req.params;

	const superAdmin = await SuperAdmin.findByIdAndDelete(superAdminId);

	if (!superAdmin) {
		throw new ApiError(httpStatus.NOT_FOUND, ' Super Admin not found');
	}

	res
		.status(httpStatus.OK)
		.json({ message: ' Super Admin deleted successfully' });
});

const toggleUserStatus = Asyncly(async (req, res) => {
	const { userId } = req.params;

	const user = await User.findById(userId);
	if (!user) {
		throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
	}

	user.isActive = !user.isActive;
	await user.save();

	const statusMessage = user.isActive ? 'activated' : 'suspended';
	res
		.status(httpStatus.OK)
		.json({ message: `User ${statusMessage} successfully` });
});

const toggleDriverStatus = Asyncly(async (req, res) => {
	const { driverId } = req.params;

	const driver = await Driver.findById(driverId);
	if (!driver) {
		throw new ApiError(httpStatus.NOT_FOUND, 'Driver not found');
	}

	driver.isActive = !driver.isActive;
	await driver.save();

	const statusMessage = driver.isActive ? 'activated' : 'suspended';
	res
		.status(httpStatus.OK)
		.json({ message: `Driver ${statusMessage} successfully` });
});

const toggleRestaurantStatus = Asyncly(async (req, res) => {
  const { restaurantId } = req.params;

  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Restaurant not found');
  }

  // Save the previous isActive status for later comparison
  const previousIsActive = restaurant.isActive;

  // Update the restaurant status
  restaurant.isActive = !restaurant.isActive;
  await restaurant.save();

  // Update the availability status of the foods associated with the restaurant
  if (previousIsActive !== restaurant.isActive) {
    // Only update food availability if the status has changed
    const newFoodAvailability = restaurant.isActive;

    // Update all foods associated with the restaurant
    await Food.updateMany(
      { restaurant: restaurantId },
      { isAvailable: newFoodAvailability }
    );
  }

  const statusMessage = restaurant.isActive ? 'activated' : 'suspended';
  res.status(httpStatus.OK).json({ message: `Restaurant ${statusMessage} successfully` });
});








module.exports = {
	toggleUserStatus,
	toggleDriverStatus,
	toggleRestaurantStatus,
	registerSuperAdmin,
	deleteSuperAdmin,
	approveRestaurant,
	editSuperAdmin,
	loginSuperAdmin,
	approveDriver,
	getSuperAdmin,
	getAllSuperAdmins,
	changePassword,
	superAdminForgotPassword,
	superAdminResetPassword,
	updateProfilePictureSuperAdmin,
};
