/* eslint-disable import/order */
const Asyncly = require('../../utils/Asyncly');
const httpStatus = require('http-status');
// eslint-disable-next-line no-unused-vars
const { z } = require('zod');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
// eslint-disable-next-line no-unused-vars
const { ZodError } = require('zod');
const authValidation = require('../../validation/authValidation');
require('dotenv/config');
const mongoose = require('mongoose');

const crypto = require('crypto');
const sendEmail = require('../../helpers/sendMail');
const User = require('../../models/users');
const ApiError = require('../../utils/ApiError');
const { HttpStatusCode } = require('axios');
const logger = require('../../config/logger');

// populateDefaultImage();

const login = Asyncly(async (req, res) => {
  const loginData = authValidation.loginSchema.parse(req.body);
  const { rememberMe } = req.body;

  const user = await User.findOne({ email: loginData.email }).select(
    '+password',
  );

  if (!user) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      'Account not found. Create an account',
    );
  }
  if (!user.isActive) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User suspended');
  }

  const isValidPassword = await bcrypt.compare(
    loginData.password,
    user.password,
  );

  if (!isValidPassword) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Incorrect password!');
  }

  const tokenExpiration = rememberMe ? '30d' : '10d';

  const token = jwt.sign(
    { id: user._id, userType: user.userType },
    process.env.JWT_SECRET,
    { expiresIn: tokenExpiration },
  );

  //await User.findByIdAndUpdate(user._id, { rememberMe });
  // Create a new object with only necessary information for the response

  const responseData = {
    message: 'Login successful',
    token,
    user: {
      id: user._id,
      firstname: user?.firstName,
      lastname: user?.lastName,
      brandName: user?.brandName || '',
      brandImage: user.brandImage || '',
      email: user.email,
      phoneNumber: user.phoneNumber,
      image: user.image,
      isVerified: user.isVerified,
      isActive: user.isActive,
      userType: user.userType,
    },
  };

  return res.status(httpStatus.OK).json(responseData);
});

const verifyAccount = Asyncly(async (req, res) => {
  const { otp } = req.body;

  if (!otp) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'otp is required');
  }
  const user = await User.findOne({ otp }).select('+otp');

  if (!user) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid otp');
  }

  // Update the user's verification status
  user.isVerified = true;
  await user.save();

  return res.status(httpStatus.OK).json({
    message: 'Account verified successfully. You can now log in.',
  });
});

const resendVerificationCode = Asyncly(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email }).select('+otp +otpExpire');

  if (!user) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      'Email not associated with a user.',
    );
  }

  // If the user is already verified, return an error or a message as needed
  if (user.isVerified) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email is already verified');
  }

  // Generate a new verification code
  const newVerificationCode = Math.floor(
    1000 + Math.random() * 9000,
  ).toString();

  user.otp = newVerificationCode;
  user.otpExpire = Date.now() + 600000;

  // Save the updated user with the new verification code
  await user.save();

  const emailContent = `Your new otp is: ${newVerificationCode}. It expires in 10 minutes`;

  // Send the email with the new verification code
  await sendEmail({
    to: user.email,
    subject: 'Resend Verification Code',
    text: emailContent,
  });

  return res.status(httpStatus.OK).json({
    message: 'Verification code resent successfully. Check your email.',
  });
});

const forgotPassword = Asyncly(async (req, res) => {
  const validatedEmail = authValidation.forgotPasswordSchema.parse(req.body);
  const user = await User.findOne({ email: validatedEmail.email }).select(
    '+otp +otpExpire',
  );
  if (!user) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      'Email address not associated to a user',
    );
  }

  // Generate a 4-digit OTP
  const otp = Math.floor(1000 + Math.random() * 9000).toString();

  // Set the OTP and expiration time in the user document
  user.otp = otp;
  user.otpExpire = Date.now() + 600000; // OTP expires in 10 minutes

  await user.save();

  // Send the OTP to the user via email or another channel
  const message = `You have requested a password reset on PlaceBuy. Your OTP for password reset is: ${otp}. Please use this code to reset your password within the next 10 minutes. If you did not request this, please ignore this message.`;

  try {
    // Send the OTP
    sendEmail({
      to: validatedEmail.email,
      subject: 'Password Reset OTP',
      text: message,
    });
    return res.status(200).json({
      message: 'OTP sent successfully. Please check your email for the code.',
    });
  } catch (error) {
    user.otp = undefined;
    user.otpExpire = undefined;
    await user.save();
    logger.error('Error sending forgot password otp');
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Otp could not be sent',
    );
  }
});

const userResetPassword = Asyncly(async (req, res) => {
  const requestData = authValidation.resetPasswordSchema.parse(req.body);
  const { otp, password } = requestData;

  const user = await User.findOne({
    otp,
    otpExpire: { $gt: Date.now() },
  }).select('+otp +otpExpire');

  if (!user) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid or expired OTP');
  }

  // Reset the password
  user.password = bcrypt.hashSync(password, 10);
  user.otp = undefined;
  user.otpExpire = undefined;

  await user.save();

  return res.status(httpStatus.OK).json({
    success: true,
    message: 'Password reset successfully. Login!',
  });
});

const resendOtp = Asyncly(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email }).select('+otp +otpExpire');

  if (!user) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      'Email not associated with a user.',
    );
  }

  // Generate a new verification code
  const newVerificationCode = Math.floor(
    1000 + Math.random() * 9000,
  ).toString();

  user.otp = newVerificationCode;
  user.otpExpire = Date.now() + 600000;

  // Save the updated user with the new verification code
  await user.save();

  const emailContent = `Your new otp is: ${newVerificationCode}. It expires in 10 minutes`;

  // Send the email with the new verification code
  await sendEmail({
    to: user.email,
    subject: 'Resend OTP',
    text: emailContent,
  });

  return res.status(httpStatus.OK).json({
    message: 'Code sent successfully. Check your email.',
  });
});

module.exports = {
  login,
  forgotPassword,
  userResetPassword,
  verifyAccount,
  resendOtp,
  //changePasswordUser,
  //changePasswordWithoutCurrentUser,
  resendVerificationCode,
};

/**const changePasswordWithoutCurrentUser = Asyncly(async (req, res) => {
  const { userId } = req.params;
  const { newPassword } = req.body;

  try {
    const user = await User.findById(userId);

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'user not found');
    }

    // Hash the new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update the user's password
    user.password = hashedNewPassword;

    await user.save({ validateBeforeSave: false });

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
const changePasswordUser = Asyncly(async (req, res) => {
  const { userId } = req.params;

  // Validate request body against passwordChangeSchema
  const passwordData = authValidation.passwordChangeSchema.parse(req.body);

  // Find the admin by ID
  const user = await User.findById(userId);

  // Check if the admin exists
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  // Compare the entered current password with the hashed password
  const isPasswordValid = await bcrypt.compare(
    passwordData.currentPassword,
    user.password,
  );

  // Check if the current password is valid
  if (!isPasswordValid) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid current password');
  }

  // Hash the new password
  const hashedNewPassword = await bcrypt.hash(passwordData.newPassword, 10);

  // Update the admin's password only
  user.password = hashedNewPassword;

  // Save the admin document without triggering unnecessary validations
  await user.save({ validateBeforeSave: false });

  res.status(httpStatus.OK).json({ message: 'Password changed successfully' });
});*/
