const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const orderController = require('../controllers/orderController');
const { Server } = require("socket.io");


// Initialize Socket.IO
// const io = new Server(server, { cors: { origin: "*" } });




// Route to place a new order
router.post('/place-order', requireAuth, orderController.placeOrder);
router.get('/:id', orderController.getOrderDetails);
router.get('/restaurantorderss/:restaurantId', orderController.getRestaurantOrderss);
router.get('/driverorders/:driverId', orderController.getDriverOrders);
router.get('/sumOrders/sum', orderController.getSumDeliveredOrders);
router.get('/', orderController.getAllOrders);
router.get('/user-orders/:id', orderController.getUserOrders);

module.exports = router;
