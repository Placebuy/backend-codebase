const express = require('express');

const router = express.Router();
const { verifySuperAdmin } = require('../middleware/authMiddleware');

const companyController = require('../controllers/companyController');
const validate = require('../utils/validate');
const companyValidation = require('../validation/companyValidation');
const authValidation = require('../validation/authValidation');

router.post(
	'/create',
	validate(companyValidation.companySchema),
	companyController.createCompany,
);
router.post(
	'/forgotpassword',
	validate(authValidation.forgotPasswordSchema),
	companyController.companyForgotPassword,
);

router.put(
	'/profile/picture/:companyId',
	companyController.updateCompanyPicture,
);

router.put(
	'/resetpassword/:resetToken',
	validate(authValidation.resetPasswordSchema),
	companyController.companyResetPassword,
);
router.post(
	'/changepassword/:companyId',
	companyController.changePasswordCompany,
);
router.get('/details/:companyId', companyController.getCompanyDetails);
router.put('/edit/:companyId', companyController.editCompanyDetails);

module.exports = router;
