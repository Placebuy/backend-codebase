// eslint-disable-next-line no-unused-vars
const express = require('express');
const httpStatus = require('http-status');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Company = require('../models/company');
const Asyncly = require('../utils/Asyncly');
const ApiError = require('../utils/ApiError');
const companyValidation = require('../validation/companyValidation');
const authValidation = require('../validation/authValidation');
const sendEmail = require('../helpers/sendMail');
// eslint-disable-next-line import/order
const cloudinary = require('cloudinary').v2;

// Create a new company
const createCompany = Asyncly(async (req, res) => {
	const companyData = companyValidation.companySchema.parse(req.body);
	const hashedPassword = await bcrypt.hash(companyData.password, 10);
	companyData.password = hashedPassword;
	const newCompany = await Company.create(companyData);
	return res.status(httpStatus.CREATED).json(newCompany);
});

const editCompanyDetails = Asyncly(async (req, res) => {
	const { companyId } = req.params;
	const updatedData = req.body;
	if (updatedData.password) {
		const hashedPassword = await bcrypt.hash(updatedData.password, 10);
		updatedData.password = hashedPassword;
	}
	const updatedCompany = await Company.findByIdAndUpdate(
		companyId,
		updatedData,
		{ new: true },
	);
	if (!updatedCompany) {
		throw new ApiError(httpStatus.NOT_FOUND, 'Company not found');
	}
	return res.status(httpStatus.OK).json(updatedCompany);
});

const getCompanyDetails = Asyncly(async (req, res) => {
	const { companyId } = req.params;
	const companyDetails = await Company.findById(companyId, { password: 0 });
	if (!companyDetails) {
		throw new ApiError(httpStatus.NOT_FOUND, 'Company not found');
	}
	return res.status(httpStatus.OK).json(companyDetails);
});

const updateCompanyPicture = Asyncly(async (req, res) => {
	const { companyId } = req.params;
	if (!req.files || !req.files.image) {
		throw new ApiError(httpStatus.BAD_REQUEST, 'No image file provided');
	}
	// eslint-disable-next-line camelcase
	const { secure_url } = await cloudinary.uploader.upload(
		req.files.image.tempFilePath,
		{
			use_filename: true,
			folder: 'Company Image',
		},
	);
	const updatedCompany = await Company.findByIdAndUpdate(
		companyId,
		// eslint-disable-next-line camelcase
		{ image: secure_url },
		{ new: true },
	);
	res.json({
		message: 'Profile picture updated successfully',
		company: updatedCompany,
	});
});

const companyForgotPassword = Asyncly(async (req, res) => {
	const validatedEmail = authValidation.forgotPasswordSchema.parse(req.body);
	const company = await Company.findOne({ email: validatedEmail.email });

	if (!company) {
		return res.status(404).json({ success: false, message: 'email.sent' });
	}

	const resetToken = company.getResetPasswordToken();
	await company.save();

	const resetUrl = `http://localhost:5173/password/${resetToken}`;
	const message = `
    <h1>You have requested for a password reset</h1>
    <p>Please go to the link to reset your password:</p>
    <a href=${resetUrl} clicktracking=off>${resetUrl}</a>
  `;

	try {
		await sendEmail({
			to: validatedEmail.email,
			subject: 'Password Reset Request',
			text: message,
		});

		return res.status(200).json({ success: true, data: 'Email sent' });
	} catch (error) {
		company.getResetPasswordToken = undefined;
		company.getResetPasswordExpire = undefined;
		await company.save();

		return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
			message: 'Email could not be sent',
			error,
		});
	}
});

const companyResetPassword = Asyncly(async (req, res) => {
	const requestData = authValidation.resetPasswordSchema.parse(req.body);
	const { password } = requestData;

	const { resetToken } = req.params;
	const hashedResetToken = crypto
		.createHash('sha256')
		.update(resetToken)
		.digest('hex');

	const user = await Company.findOneAndUpdate(
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

	if (!user) {
		throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid reset token');
	}

	res
		.status(httpStatus.CREATED)
		.json({ success: true, message: 'Password reset successfully' });
});

const changePasswordCompany = Asyncly(async (req, res) => {
	const { companyId } = req.params;

	// Validate request body against passwordChangeSchema
	const passwordData = req.body;

	// Find the admin by ID
	const company = await Company.findById(companyId);

	// Check if the admin exists
	if (!company) {
		throw new ApiError(httpStatus.NOT_FOUND, 'Company not found');
	}

	// Compare the entered current password with the hashed password
	const isPasswordValid = await bcrypt.compare(
		passwordData.currentPassword,
		company.password,
	);

	// Check if the current password is valid
	if (!isPasswordValid) {
		throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid current password');
	}

	// Hash the new password
	const hashedNewPassword = await bcrypt.hash(passwordData.newPassword, 10);

	// Update the admin's password only
	company.password = hashedNewPassword;

	// Save the admin document without triggering unnecessary validations
	await company.save({ validateBeforeSave: false });

	res.status(httpStatus.OK).json({ message: 'Password changed successfully' });
});

module.exports = {
	createCompany,
	editCompanyDetails,
	getCompanyDetails,
	updateCompanyPicture,
	companyForgotPassword,
	companyResetPassword,
	changePasswordCompany,
};
