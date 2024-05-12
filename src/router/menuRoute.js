const express = require('express');

const router = express.Router();
const { requireAuth, verifyAdmin } = require('../middleware/authMiddleware');
const menuController = require('../controllers/menuController');

router.post('/:restaurantId', menuController.addMenu);
router.patch('/editmenu/:id', menuController.editMenu);
router.get('/:id', menuController.getMenuById);
router.put('/availability/:id', menuController.menuAvailability);
router.delete('/delete/:id', menuController.deleteMenuById); // <-- Updated this line

// get all menus by restaurant
router.get(
	'/menusrestaurant/:restaurantId',
	menuController.getMenusByRestaurant,
);

module.exports = router;
