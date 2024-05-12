const express = require('express');
const router = express.Router();
const disputeController = require('../controllers/disputesController');
const {
	verifyRestaurant,
	verifyAdmin,
} = require('../middleware/authMiddleware');

// Route to list all nature of complaints
router.get('/nature-of-complaints', disputeController.listNatureOfComplaints);

// Route to get a dispute by ID
router.get('/:id', disputeController.getDisputeById);

// Route to delete a dispute by ID
router.delete('/:id', disputeController.deleteDisputeById);

// Route to send a dispute
router.post('/',verifyRestaurant, disputeController.sendDispute);

// Route to get all disputes by restaurant
router.get('/restaurant/:restaurantId', disputeController.getDisputesByRestaurant);

module.exports = router;
