const express = require('express');
const driverProfileController = require('../controllers/driverProfileController');

const { verifyDriver } = require('../middleware/authMiddleware');

const router = express.Router();
// router.get('/', driverProfileController.getAllDrivers);
// router.get('/:driverId', driverProfileController.getSingleDriver);
// router.put('/:driverId', driverProfileController.updateDriverProfile);
// router.patch('/:driverId', driverProfileController.updateDriverAvailability);
// router.delete('/:driverId', driverProfileController.deleteDriver);
// router.post('/accept', driverProfileController.acceptAndAssignOrder);
// router.get('/:driverId/orders', driverProfileController.listAssignedOrder);
// router.patch(
// 	'/order/:orderId/status',
// 	driverProfileController.updateDriverOrderStatus,
// );
// router.put(
// 	'/order/:driverId/status',
// 	driverProfileController.updateOrderDeliveryStatus,
// );
// router.get(
// 	'/orders/assigned/:driverId',
// 	driverProfileController.viewOrderDetail,
// );
// router.get('/sum/sumDrivers', driverProfileController.getSumApprovedDrivers);
// router.put('/cancel/:orderId', driverProfileController.driverCancelOrder);
// router.get(
// 	'/list/available-order',
// 	driverProfileController.listAvailableOrders,
// );
// router.put('/arrive/:orderId', driverProfileController.driverArrive);

router.get('/', driverProfileController.getAllDrivers);
router.get('/:driverId', driverProfileController.getSingleDriver);
router.put('/:driverId', driverProfileController.updateDriverProfile);
router.patch('/:driverId', driverProfileController.updateDriverAvailability);
router.delete('/:driverId', driverProfileController.deleteDriver);
router.post('/accept-order/:driverId', driverProfileController.acceptAndAssignOrder);
router.get('/:driverId/orders', driverProfileController.listAssignedOrder);
router.get('/sum/sumDrivers', driverProfileController.getSumApprovedDrivers);
router.put('/cancel/:orderId', driverProfileController.driverCancelOrder);
router.get('/orders/available', driverProfileController.listAvailableOrders);
router.put('/arrive/:driverId', driverProfileController.driverArrive);
router.get('/pending/deliveries', driverProfileController.totalAvailable);
router.patch('/update-driver-location/:driverId', (req, res) => {
	const { latitude, longitude } = req.body;
	const { driverId } = req.params;
  driverProfileController.updateDriverLocation(driverId, latitude, longitude);
	res.sendStatus(200);
});

module.exports = router;       
