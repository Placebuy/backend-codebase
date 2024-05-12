const express = require('express');
const validate = require('../utils/validate');
const authValidation = require('../validation/authValidation');
const adminValidation = require('../validation/adminValidation');
const { requireAuth, verifyAdmin, verifySuperAdmin } = require('../middleware/authMiddleware');
const adminController = require('../controllers/adminController');

const router = express.Router();

router.get('/:adminId', adminController.getSingleAdmin);
router.get('/', adminController.getAllAdmins);
router.patch(
	'/:adminId',
	validate(adminValidation.editAdminSchema),
	adminController.editAdmin,
);
router.patch('/:adminId/picture', adminController.updateProfilePicture);
router.delete('/:adminId/delete',verifySuperAdmin, adminController.deleteAdmin);
router.post(
	'/changepassword/:adminId',
	validate(authValidation.passwordChangeSchema),
	adminController.changePassword,
);
router.post(
	'/forgotpassword',
	validate(authValidation.forgotPasswordSchema),
	adminController.adminForgotPassword,
);

router.put(
	'/resetpassword/:resetToken',
	validate(authValidation.resetPasswordSchema),
	adminController.adminResetPassword,
);

module.exports = router;
