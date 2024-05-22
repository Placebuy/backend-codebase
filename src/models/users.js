const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { default: validator } = require('validator');
const crypto = require('crypto');

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      //required: true,
      trim: true,
      minLength: [3, 'Minimum length must be 3'],
    },
    businessName: { type: String,
      //required: true,
      unique: true,
    },
    image: String,
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator(value) {
          if (!validator.isEmail(value)) {
            throw new Error('Email is invalid');
          }
        },
      },
    },
    phoneNumber: {
      type: String,
      unique: true,
      //required: true,
      minLength: [10, 'Minimum length must be 10'],
    },
    password: {
      type: String,
      required: true,
      minlength: [8, 'Minimum length must be 8'],
      validate: {
        validator(value) {
          if (value.toLowerCase().includes('password')) {
            throw new Error('Password must not contain "password"');
          }
        },
        select: false,
      },
    },
    institution: String,
    address: String,
    /**resetPasswordToken: {
      type: String,
      select: false,
    },*/
    otpExpire: {
      type: Date,
      select: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    otp: {
      type: String,
      select: false,
      expires: 600,
    },
    userType: {
      type: String,
      enum: [
        'Buyer',
        'Vendor',
        'Admin',
      ]
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

/*rememberMe: {
      type: Boolean,
      default: false,
    },*/

// Define the method to generate reset password token
userSchema.methods.getResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(20).toString('hex');
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  this.resetPasswordExpire = new Date(Date.now() + 10 * 60 * 1000); // Set to 10 minutes from now
  return resetToken;
};

module.exports = mongoose.model('User', userSchema);
