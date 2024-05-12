const express = require('express');

const router = express.Router();
// const { requireAuth, verifyAdmin } = require('../middleware/authMiddleware');
const superAdminController = require('../controllers/superAdminController');
const validate = require('../utils/validate');
const authValidation = require('../validation/authValidation');
const adminValidation = require('../validation/adminValidation');

router.get('/:superAdminId', superAdminController.getSuperAdmin);
router.get('/', superAdminController.getAllSuperAdmins);

router.patch(
	'/:id',
	validate(adminValidation.editAdminSchema),
	superAdminController.editSuperAdmin,
);

router.patch(
	'/picture/:superAdminId',
	superAdminController.updateProfilePictureSuperAdmin,
);
router.post(
	'/changepassword/:superAdminId',
	validate(authValidation.passwordChangeSchema),
	superAdminController.changePassword,
); 

router.post(
	'/forgotpassword',
	superAdminController.superAdminForgotPassword,
);

router.put(
	'/resetpassword/:resetToken',
	validate(authValidation.resetPasswordSchema),
	superAdminController.superAdminResetPassword,
);

router.delete('/delete/:superAdminId', superAdminController.deleteSuperAdmin);
// router.put('/:superAdminId/picture', superAdminController.updateProfilePictureSuperAdmin);

module.exports = router;
