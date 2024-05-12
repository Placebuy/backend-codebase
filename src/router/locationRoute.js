const express = require('express');
const userAddressController = require('../controllers/userAddressController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/',  userAddressController.createAddress);
router.get('/:id',  userAddressController.getRecentAddresses);

// delivery address
router.get('/order-address/:id',  userAddressController.getAddress);

module.exports = router;
