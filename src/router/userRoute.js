const express = require('express');

const router = express.Router();
const { requireAuth, verifyAdmin } = require('../middleware/authMiddleware');
const userProfileController = require('../controllers/userProfileController');
const authValidation = require('../validation/authValidation');
const updateValidation = require('../validation/updateValidation');
const validate = require('../utils/validate');
const authController = require('../controllers/authController');
// Route to get user profile
router.get('/profile/:userId',userProfileController.getUserProfileMiddleware, userProfileController.getUserProfile);

router.get('/sumallusers', userProfileController.getSumVerifiedUsers);

router.patch(
	'/:userId/update-profile-picture',
	userProfileController.updateProfilePicture,
);

// Route to update user profile
router.patch(
	'/profile/update/byId/:userId',

	validate(updateValidation.updateUserSchema),   
	userProfileController.updateUserProfile,
);

// Route to delete user profile
router.delete(
	'/profile/delete/:userId',
	
	userProfileController.deleteUserProfile,
);

// Route to get all  users profile
router.get('/profile', userProfileController.getAllUsers);

// user change password
router.post(
	'/changepassword/:userId',
	validate(authValidation.passwordChangeSchema),
	authController.changePasswordUser,
);

router.get('/wallet', requireAuth, userProfileController.getUserWalletDetails);

module.exports = router;
