/* eslint-disable import/order */

const Asyncly = require('../../utils/Asyncly');
const httpStatus = require('http-status');
// eslint-disable-next-line no-unused-vars
const { z } = require('zod');
const bcrypt = require('bcrypt');
// eslint-disable-next-line no-unused-vars
const { ZodError } = require('zod');
const authValidation = require('../../validation/authValidation');
const sendEmail = require('../../helpers/sendMail');
const User = require('../../models/users');
const ApiError = require('../../utils/ApiError');
const logger = require('../../config/logger');

require('dotenv/config');

const registerAdmin = Asyncly(async (req, res) => {
  const validatedData = authValidation.signupSchema.parse(req.body);

  const existingUser = await User.findOne({
    email: validatedData.email,
  }).select('+otp');
  if (existingUser) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Email already registered. Login instead!',
    );
  }

  const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
  const hashedPassword = await bcrypt.hash(validatedData.password, 10);

  const newUser = new User({
    ...validatedData,
    password: hashedPassword,
    otp: verificationCode,
    userType: 'Admin',
  });

  await newUser.save();

  const emailContent = `Your verification code is: ${verificationCode}. Please use this code to complete your registration on Placebuy. This OTP will expire in 10 minutes.`;

  await sendEmail({
    to: validatedData.email,
    subject: 'Email Verification',
    text: emailContent,
  });

  return res.status(httpStatus.CREATED).json({
    message:
      "Registeration successful!. We've sent a verification code to your email. Please check your inbox to complete the registration process.",
  });
});

module.exports = registerAdmin;
