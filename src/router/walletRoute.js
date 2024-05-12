const express = require('express');
const router = express.Router();
const walletController = require('../controllers/driverWalletController');

// Route for topping up the driver's wallet
// router.post('/top-up', walletController.topUpWallet);

// Route for getting recent transactions of the driver's wallet
router.post('/recent-transactions/:driverId', walletController.getRecentTransactions);

// Route for making a withdrawal from the driver's wallet
router.post('/withdrawal', walletController.makeWithdrawal);


router.post('/create', walletController.createRecipient)
//router.get('/list', walletController.listBanks)

module.exports = router;
