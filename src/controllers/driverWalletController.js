const httpStatus = require('http-status');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const DriverWallet = require('../models/driverWallet');
const Asyncly = require('../utils/Asyncly');
const ApiError = require('../utils/ApiError');
const Driver = require('../models/driver');
const config = require('../config/auth');
const { log } = require('winston');

const apiKey = config.paystackKey;

// const topUpWallet = Asyncly(async (req, res) => {
// 	const { driverId, amount } = req.body;

// 	// Fetch or create driver's wallet
// 	const wallet = await DriverWallet.findOneAndUpdate(
// 		{ driverId },
// 		{ $inc: { balance: amount } },
// 		{ new: true, upsert: true },
// 	);

// 	// Create a top-up transaction
// 	const transaction = {
// 		type: 'credit',
// 		amount,
// 		description: 'Wallet top-up',
// 	};

// 	// Add the transaction to the driver's wallet
// 	wallet.transactions.push(transaction);

// 	// Save the updated wallet and transaction records to the database
// 	await wallet.save();

// 	// Return a success response
// 	res.status(httpStatus.OK).json({
// 		message: 'Wallet topped up successfully',
// 		wallet,
// 	});
// });

const getRecentTransactions = Asyncly(async (req, res) => {
	const { driverId } = req.params;
	let wallet = await DriverWallet.findOne({ driverId });

	// If wallet not found, create a new one with default balance of 0
	if (!wallet) {
		wallet = new DriverWallet({
			driverId,
			balance: 0,
			transactions: [],
		});
		await wallet.save();
	}

	let transactions = [];
	if (wallet.transactions.length > 0) {
		transactions = wallet.transactions
			.slice(0, 20)
			.map(({ timestamp, amount, status }) => ({ timestamp, amount, status }));
	}

	const driver = await Driver.findById(driverId);
	const name = driver ? `${driver.firstname} ${driver.lastname}` : 'Unknown';

	res.status(httpStatus.OK).json({ name, transactions });
});

// const makeWithdrawal = Asyncly(async (req, res) => {
// 	const { driverId, amount , recipientCode} = req.body;

// 	console.log(driverId, amount, recipientCode, 'makeWithdrawal')

// 	const wallet = await DriverWallet.findOne({ driverId });

// 	if (!wallet) {
// 	}

// 	// if (amount > wallet.balance) {
// 	// 	throw new ApiError(httpStatus.BAD_REQUEST, 'Insufficient funds');
// 	// }
// 	const reference = uuidv4();

// 	const paystackResponse = await axios.post(
// 		'https://api.paystack.co/transfer',
// 		{
// 		  source: 'balance',
// 		  reason: 'Calm down',
// 		  amount,
// 		  recipient: recipientCode,
// 		  currency: 'NGN',
// 		  reference: reference,
// 		},
// 		{
// 		  headers: {
// 			Authorization: `Bearer ${apiKey}`,
// 			'Content-Type': 'application/json',
// 		  },
// 		},
// 	  );


// 	console.log(paystackResponse,"yuityity")

// 	if (paystackResponse.data.status === 'success') {
// 		wallet.balance -= amount;

// 		const transaction = {
// 			type: 'debit',
// 			amount,
// 			description: 'Withdrawal',
// 			status: 'success',
// 			timestamp: new Date(),
// 		};

// 		wallet.transactions.push(transaction);

// 		await wallet.save();

// 		res.status(httpStatus.OK).json({
// 			message: 'Withdrawal successful',
// 			transaction,
// 		});
// 	} else {
// 		throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Withdrawal failed');
// 	}
// });


// Define your interceptor
axios.interceptors.request.use(
	(config) => {
	  // Modify config or do something before request is sent
	  config.headers['Authorization'] = `Bearer ${apiKey}`;
	  console.log('Request Interceptor:', config);
	  return config;
	},
	(error) => {
	  // Handle request error
	  console.error('Request Error Interceptor:', error);
	  return Promise.reject(error);
	}
  );
  
  axios.interceptors.response.use(
	(response) => {
	  // Handle response data
	  console.log('Response Interceptor:', response);
	  return response;
	},
	(error) => {
	  // Handle response error
	  console.error('Response Error Interceptor:', error);
	  return Promise.reject(error);
	}
  );
  
  // Your function with Axios request
  const makeWithdrawal = async (req, res) => {
	const { driverId, amount, recipientCode } = req.body;
	console.log(driverId, amount, recipientCode, 'makeWithdrawal');
	const reference = uuidv4();
  
	try {
	  const paystackResponse = await axios.post(
		'https://api.paystack.co/transfer',
		{
		  source: 'balance',
		  reason: 'Calm down',
		  amount,
		  recipient: recipientCode,
		  currency: 'NGN',
		  reference: reference,
		},
		{
		  headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		  },
		}
	  );
  
	  console.log(paystackResponse, "yuityity");
  
	  if (paystackResponse.data.status === 'success') {
		// Handle success
		res.status(httpStatus.OK).json({
		  message: 'Withdrawal successful',
		  //transaction: paystackResponse.data.transaction, 
		});
	  } else {
		// Handle failure
		throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Withdrawal failed');
	  }
	} catch (error) {
	  // Handle axios request error
	  console.error('Axios Request Error:', error);
	  throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to make withdrawal');
	}
  };


const createRecipientCode = Asyncly(async (req, res) => {

	const {name, account_number, bank_code} = req.body
	let recipientCode;

	console.log('Creating recipient...');

	console.log(name, account_number, bank_code, 'yah');

	// Validate required parameters
	if (!config.paystackKey) {
		throw new Error('PAYSTACK_SECRET_KEY is not defined');   
	}     

	if (!name || !account_number || !bank_code) {    
		throw new ApiError('name, account_number, or bank_code is missing......');
	}   

	// Make API request to create recipient
	try {
		const response = await axios.post(
			'https://api.paystack.co/transferrecipient',
			{
				type: 'nuban',
				name,
				account_number,
				bank_code,
				currency: 'NGN',
			},
			{
				headers: {
					Authorization: `Bearer ${apiKey}`,
					'Content-Type': 'application/json',
				},
			},
		);

		if (response.data) {
			recipientCode = response.data.data.recipient_code;
		} else {
			throw new Error('Recipient code not found in response');
		}
	} catch (error) {
		console.error('Error creating recipient:', error.message);
		throw error;
	}

	return recipientCode;
});
module.exports = {
	getRecentTransactions,
	makeWithdrawal,
	createRecipient: createRecipientCode,
	//listBanks,
};
