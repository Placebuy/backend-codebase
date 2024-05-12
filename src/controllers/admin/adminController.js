/* eslint-disable import/order */
const httpStatus = require('http-status');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Asyncly = require('../../utils/Asyncly');
const ApiError = require('../../utils/ApiError');
const Admin = require('../models/admin');
const authValidation = require('../../validation/authValidation');
const adminValidation = require('../../validation/adminValidation');
const cloudinary = require('cloudinary').v2;
const sendEmail = require('../../helpers/sendMail');
const {Company} = require('../models/company');

const registerAdmin = Asyncly(async (req, res) => {
	if (!req.body || typeof req.body !== 'object') {
		throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid request body');
	}

	const adminData = authValidation.AdminSchema.parse(req.body);

	// Find the company
	const company = await Company.findOne();

	// Check if the admin already exists
	const existingAdmin = await Admin.findOne({ email: adminData.email });
	if (existingAdmin) {
		throw new ApiError(httpStatus.BAD_REQUEST, 'Admin already exists');
	}

	// Hash the password
	const hashedPassword = await bcrypt.hash(adminData.password, 10);

	// Create a new admin and associate it with the company
	const newAdmin = new Admin({
		...adminData,
		password: hashedPassword,
		company: company._id, // Associate admin with the company
	});

	await newAdmin.save();

	// Exclude the password field before sending the response
	const { password, ...adminWithoutPassword } = newAdmin.toObject();

	res.status(httpStatus.CREATED).json({
		message: 'Admin registered successfully',
		admin: adminWithoutPassword,
	});
});

const loginAdmin = Asyncly(async (req, res) => {
	const loginData = authValidation.loginSchema.parse(req.body);
	const { companyPassword } = req.body;
	// Find the admin by email and populate the associated company with the password field
	const admin = await Admin.findOne({ email: loginData.email }).populate(
		'company',
		'password',
	);

	// Check if the admin exists
	if (!admin) {
		throw new ApiError(httpStatus.NOT_FOUND, 'Admin not found');
	}

	// Verify the company password stored in the associated company document
	if (!admin.company || !admin.company.password) {
		throw new ApiError(
			httpStatus.INTERNAL_SERVER_ERROR,
			'Company password not available',
		);
	}

	// const isCompanyPasswordValid = await bcrypt.compare(
	// 	companyPassword,
	// 	admin.company.password,
	// );

	// if (!isCompanyPasswordValid) {
	// 	throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid company password');
	// }

	// Compare the entered password with the hashed admin password
	const isPasswordValid = await bcrypt.compare(
		loginData.password,
		admin.password,
	);

	// Check if the password is valid
	if (!isPasswordValid) {
		throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid credentials');
	}

	// Generate a JWT token
	const token = jwt.sign(
		{ id: admin._id, userType: 'Admin' },
		process.env.JWT_SECRET,
		{ expiresIn: process.env.ADMIN_EXPIRES_IN },
	);

	// Respond with success and token
	res.status(httpStatus.OK).json({ message: 'Login successful', token });
});

const updateProfilePicture = Asyncly(async (req, res) => {
	const { adminId } = req.params;

	// Check if a new profile picture is uploaded
	if (!req.files || !req.files.image) {
		throw new ApiError(httpStatus.BAD_REQUEST, 'No image file provided');
	}

	// Upload the new image to Cloudinary
	// eslint-disable-next-line camelcase
	const { secure_url } = await cloudinary.uploader.upload(
		req.files.image.tempFilePath,
		{
			use_filename: true,
			folder: 'Admin Image',
		},
	);

	// Update the user's profile picture
	const updatedUser = await Admin.findByIdAndUpdate(
		adminId,
		// eslint-disable-next-line camelcase
		{ image: secure_url },
		{ new: true },
	);

	res.json({
		message: 'Profile picture updated successfully',
		user: updatedUser,
	});
});

const getSingleAdmin = Asyncly(async (req, res) => {
	const { adminId } = req.params;

	// Find the admin by ID
	const admin = await Admin.findById(adminId);

	// Check if the admin exists
	if (!admin) {
		throw new ApiError(httpStatus.NOT_FOUND, 'Admin not found');
	}

	res.status(httpStatus.OK).json({ admin });
});

const editAdmin = Asyncly(async (req, res) => {
	const { adminId } = req.params;

	const validatedData = adminValidation.editAdminSchema.parse(req.body);

	const updatedAdmin = await Admin.findByIdAndUpdate(
			adminId,
			{ 
					username: validatedData.firstname,
					firstname: validatedData.firstname
			},
			{ new: true }
	);

	if (!updatedAdmin) {
			throw new ApiError(httpStatus.NOT_FOUND, 'Admin not found');
	}

	res.status(httpStatus.OK).json({ message: 'Admin updated successfully', updatedAdmin });
});


const getAllAdmins = Asyncly(async (req, res) => {
	// Get all admins
	const admins = await Admin.find();

	res.status(httpStatus.OK).json({ admins });
});

const deleteAdmin = Asyncly(async (req, res, next) => {
	const { adminId } = req.params;

	// Find and delete the admin by ID
	const admin = await Admin.findByIdAndDelete(adminId);

	if (!admin) {
		return next(new ApiError(httpStatus.NOT_FOUND, 'Admin not found'));
	}

	res.status(httpStatus.OK).json({ message: 'Admin deleted successfully' });
});

const changePassword = Asyncly(async (req, res) => {
	const { adminId } = req.params;

	// Validate request body against passwordChangeSchema
	const passwordData = authValidation.passwordChangeSchema.parse(req.body);

	// Find the admin by ID
	const admin = await Admin.findById(adminId);

	// Check if the admin exists
	if (!admin) {
		throw new ApiError(httpStatus.NOT_FOUND, 'Admin not found');
	}

	// Compare the entered current password with the hashed password
	const isPasswordValid = await bcrypt.compare(
		passwordData.currentPassword,
		admin.password,
	);

	// Check if the current password is valid
	if (!isPasswordValid) {
		throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid current password');
	}

	// Hash the new password
	const hashedNewPassword = await bcrypt.hash(passwordData.newPassword, 10);

	// Update the admin's password only
	admin.password = hashedNewPassword;

	// Save the admin document without triggering unnecessary validations
	await admin.save({ validateBeforeSave: false });

	res.status(httpStatus.OK).json({ message: 'Password changed successfully' });
});

const adminForgotPassword = Asyncly(async (req, res) => {
	const validatedEmail = authValidation.forgotPasswordSchema.parse(req.body);
	const admin = await Admin.findOne({ email: validatedEmail.email });

	if (!admin) {
		return res.status(404).json({ success: false, message: 'Email not found' });
	}

	const resetToken = admin.getResetPasswordToken();
	await admin.save();

	const resetUrl = `https://delivery-registration.vercel.app/password/${resetToken}`;
	const message = `<h1>You have requested a password reset</h1><p>Please click the link to reset your password:</p><a href=${resetUrl} clicktracking=off>${resetUrl}</a>`;

	try {
		await sendEmail({
			to: validatedEmail.email,
			subject: 'Password Reset Request',
			text: message,
		});

		res.status(200).json({ success: true, data: 'Email sent' });
	} catch (error) {
		return res
			.status(500)
			.json({ success: false, message: 'Failed to send email', error });
	}
});

const adminResetPassword = Asyncly(async (req, res) => {
	const requestData = authValidation.resetPasswordSchema.parse(req.body);
	const { password } = requestData;

	const { resetToken } = req.params;
	const hashedResetToken = crypto
		.createHash('sha256')
		.update(resetToken)
		.digest('hex');

	const admin = await Admin.findOneAndUpdate(
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

	if (!admin) {
		throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid reset token');
	}

	res
		.status(httpStatus.CREATED)
		.json({ success: true, message: 'Password reset successfully' });
});

module.exports = {
	changePassword,
	registerAdmin,
	loginAdmin,
	updateProfilePicture,
	getSingleAdmin,
	editAdmin,
	getAllAdmins,
	deleteAdmin,
	adminForgotPassword,
	adminResetPassword,
};
