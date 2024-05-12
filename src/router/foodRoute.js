const express = require('express');
const foodController = require('../controllers/foodController');
const { verifyRestaurant, requireAuth } = require('../middleware/authMiddleware');
const recentSearchController = require('../controllers/recentSearchController');


const additive  = require('../controllers/additiveController');

const router = express.Router();

router.post('/:restaurantId', foodController.addFood);
router.get('/:id', foodController.getFoodById);
router.patch('/edit-restaurant/:id', foodController.updateFoodById);
router.put('/image/:foodId', foodController.updateFoodPicture);
// router.get('/:category/:longitude/:latitude', foodController.getRandomFoodByCategoryAndCode);
router.get('/:category/sorted', foodController.getRandomFoodByCategoryAndCode);
router.delete('/:id',  foodController.deleteFoodById);
router.patch('/:id', foodController.foodAvailability);
router.get('/menu/:menuId', foodController.getAllFoodsUnderMenu);
router.get('/menus/:menuId', foodController.getAllFoodsUnderMenuRestaurant);
router.get(
	'/restaurant/:restaurantId',
	foodController.getFoodByRestaurant,
);

router.get(
	'/sorted', foodController.getAllFoodsSorted,
); 

router.get(
	'/totalitems/:restaurantId', 
	foodController.getTotalFoodsByRestaurant,
);
router.put('/recent-search',requireAuth, recentSearchController.addRecentSearch);
router.get('/recent/search',requireAuth, recentSearchController.getLast5RecentSearches);
router.delete('/delete-search/:id',requireAuth, recentSearchController.deleteRecentSearchById);

// router.get(
// 	'/restaurant/food/:restaurantId',
// 	foodController.getFoodByRestaurant,
// );

// additve router
router.post('/additive/:restaurantId', additive.createAdditive);
router.put('/additive/:additiveId', additive.updateAdditiveById);
router.get('/additive-group/:additiveGroupId', additive.getAdditiveGroupById);
router.patch('/additive-group/:additiveGroupId', additive.updateAdditiveGroupById);
router.get('/additive/:restaurantId', additive.getAllAdditivesByRestaurant);
router.delete('/additive-group/:additivegroupId', additive.deleteGroupAdditiveById);
router.get('/additive/group/:restaurantId', additive.getAllGroupAdditivesByRestaurant);
router.delete('/additive/:additiveId', additive.deleteAdditiveById);
router.patch('/additive-availbility/:additiveId', additive.additiveAvailability);
router.patch('/additive-availbility/:additiveId', additive.additiveGroupAvailability);
router.post('/additive-group/:restaurantId', additive.createAdditiveGroup);


module.exports = router;   
