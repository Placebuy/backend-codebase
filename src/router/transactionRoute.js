const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const mongoose = require('mongoose');


const router = express.Router();

const { getAllTransactions,
	getTransactionById,
	//initiatePaystackTransaction,
	verifyTransaction,
	//createDedicatedVirtualAccount,
	getCustomerDedicatedVirtualAccount,
	paystackWebHook, 
	getAllTransactionsByUserId} = require('../controllers/transactionController');
const { topUpWallet } = require('../controllers/companyService');

router.get('/', getAllTransactions);
//router.post('/initialize', requireAuth, initiatePaystackTransaction);
router.post('/verify/:reference', requireAuth, verifyTransaction);
//router.get('/paystack/customer', requireAuth, createDedicatedVirtualAccount);
router.get('/dedicated-customer/:userId',  getCustomerDedicatedVirtualAccount);
router.get('/user/:userId', getAllTransactionsByUserId);
router.post('/user-topup/:userId',topUpWallet );
router.post('/paystack/webhook', paystackWebHook);
module.exports = router;
    