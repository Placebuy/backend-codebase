const express = require('express');

const router = express.Router();
const {
	verifyRestaurant,
	verifyAdmin,
} = require('../middleware/authMiddleware');

const restaurantController = require('../controllers/restaurantController');
const validate = require('../utils/validate');
const authValidation = require('../validation/authValidation');
const {
	getSumAvailableFoods,
	getAllFoodsSorted,
} = require('../controllers/foodController');
const RestaurantDiscount = require('../models/restaurantDiscount');
const { createRestaurantDiscount, editRestaurantDiscount, getAllDiscounts, getAllDiscountsByRestaurant, getAllMenuDiscounts } = require('../controllers/restaurantDiscount');

// Route to register restaurant
router.post(
	'/',
	restaurantController.registerRestaurant,
);

// get restaurant not protected a user musnt sign up before seeing restaurants
router.get('/byId/:id', restaurantController.getRestaurant);
router.get('/sorted', restaurantController.getAllRestaurantsSorted);
router.get('/sumRestaurants', restaurantController.getSumApprovedRestaurants);

// food router
router.get('/sumFoods', getSumAvailableFoods);
router.get('/sortedFoods', getAllFoodsSorted);

router.get('/', restaurantController.getAllRestaurants);

// Route to update  restaurant
router.patch('/:id', restaurantController.updateRestaurant);

router.patch(
	'/available/:id',
	restaurantController.serviceAvailability,
);

// route to get random restaurant
router.get('/:code', restaurantController.getRandomRestaurant);

// Route to delete Restaurant
router.delete('/:id', restaurantController.deleteRestaurant);
router.post('/confirmorder/:orderId', restaurantController.confirmOrder);
router.post('/declineorder/:orderId', restaurantController.declineOrder);
router.post('/dispatchorder/:orderId', restaurantController.dispatchOrder);

router.post(
	'/changepassword/:restaurantId',
	validate(authValidation.passwordChangeSchema),
	restaurantController.changePasswordRestaurant,
);
router.post(
	'/changepassword/verifyadmin/:restaurantId',
	restaurantController.changePasswordWithoutCurrent,
);

router.post(
	'/forgotpassword',
	validate(authValidation.forgotPasswordSchema),
	restaurantController.forgotPasswordRestaurant,
);

router.put(
	'/resetpassword/:resetToken',
	validate(authValidation.resetPasswordSchema),
	restaurantController.resetPasswordRestaurant,
);
router.put('/image/:restaurantId', restaurantController.updateProfilePicture);
router.get('/pending/:restaurantId', restaurantController.totalPending);
router.get('/confirm/:restaurantId', restaurantController.totalConfirmed);
router.get('/ontheway/:restaurantId', restaurantController.totalDispatched);
router.get('/delivered/:restaurantId', restaurantController.totalDelivered);
router.post('/restaurantDiscount/create', createRestaurantDiscount);
router.patch('/restaurantDiscount/edit/:discountId', editRestaurantDiscount);
// router.get('/restaurantDiscount/all', getAllDiscounts);
router.get('/:restaurantId/restaurantDiscount', getAllDiscountsByRestaurant); 
router.get('/get-discount/all', getAllMenuDiscounts);

router.post('/dispatchorder/:orderId', restaurantController.dispatchOrder);


module.exports = router   