// routes.js

const express = require('express');
const router = express.Router();
const walletController = require('../controllers/restaurantWalletController');
const {
	verifyRestaurant,
	verifyAdmin,
} = require('../middleware/authMiddleware');
const { moveSwiftBalance, createSendRestaurantbal, updateApprovedStatus, getAllMovedTransactions } = require('../controllers/companyService');

// Route to handle restaurant withdrawals
router.post('/withdraw/:restaurantId',verifyRestaurant,walletController.withdraw);

// Route to get recent account details
router.get('/account-details/:restaurantId', walletController.getRecentAccountDetails);

// Route to get available balance and swift balance
router.get('/balances/:restaurantId', verifyRestaurant, walletController.getBalances);

// Route to get pending withdrawals
router.get('/pending-withdrawals', walletController.getPendingWithdrawals);

// Route to update withdrawal status
router.put('/withdrawals/:withdrawalId', walletController.updateWithdrawalStatus);
router.put('/reverse-money/:restaurantId/:withdrawalId', walletController.reverseWithdrawal);



// Route to fetch all restaurants with money greater than 0 in their Swift wallet
router.get('/restaurants/with-money', walletController.getRestaurantsWithMoney);
// Route to deduct money from a restaurant's Swift wallet
router.put('/restaurants/:walletId/deduct',walletController.deductMoneyFromRestaurantWallet);
router.get('/withdrawals/:restaurantId/',verifyRestaurant, walletController.getAllRestaurantWithdrawals); 
router.get('/moved-swift/:restaurantId/', walletController.getMovedSwiftWalletBalance); 

// company service routers 
// Route to move swift balance to available balance
router.put('/move-swift-balance',verifyAdmin,moveSwiftBalance );
router.post('/send-restaurant-bal',createSendRestaurantbal );
router.put('/update-restaurant-bal/:id',updateApprovedStatus );
router.get('/all-transaction/:invoiceId',getAllMovedTransactions );



module.exports = router;
