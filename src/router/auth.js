const express = require('express');
const validate = require('../utils/validate');
const authValidation = require('../validation/authValidation');
const registerVendor  = require('../controllers/vendor/auth');
const registerBuyer = require('../controllers/buyers/auth');
const registerAdmin = require('../controllers/admin/auth');

const {
  login,
  forgotPassword,
  userResetPassword,
  verifyAccount,
	resendOtp,
  //changePasswordUser,
  //changePasswordWithoutCurrentUser,
  resendVerificationCode,
} = require('../controllers/auth/auth');


const router = express.Router();

router.post(
  '/register-admin',
  validate(authValidation.signupSchema),
  registerAdmin,
);
router.post(
  '/register-buyer',
  validate(authValidation.signupSchema),
  registerBuyer,
);
router.post(
  '/register-vendor',
  validate(authValidation.signupSchema),
  registerVendor,
);

router.post('/login', validate(authValidation.loginSchema), login);
router.post(
  '/forgot-password',
  validate(authValidation.forgotPasswordSchema),
  forgotPassword,
);
router.post(
	'/reset-password',
	validate(authValidation.resetPasswordSchema),
	userResetPassword,
);
router.post(
	'/verify-account',
	verifyAccount,
);
router.post(
	'/resend-verification-code',
	resendVerificationCode,
);
router.post(
	'/resend-otp',
	resendOtp
);

module.exports = router;
