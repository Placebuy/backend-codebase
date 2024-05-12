/* eslint-disable no-use-before-define */
const httpStatus = require('http-status');
// eslint-disable-next-line import/no-extraneous-dependencies
const axios = require('axios');
const mongoose = require('mongoose');

const crypto = require('crypto');
const Transaction = require('../models/transaction');
const Order = require('../models/order');
const ApiError = require('../../utils/ApiError');
const User = require('../models/userRoleModel');
const logger = require('../../config/logger');
const Asyncly = require('../../utils/Asyncly');
const sendPushNotification = require('../../helpers/pushNotification');
const Restaurant = require('../models/restaurant');
// const mongoose = require('mongoose');

require('dotenv').config();

const apiKey = process.env.PAYSTACK_KEY;

const getAllTransactions = Asyncly(async () => {
	const transaction = await Transaction.find().sort({ createdAt: -1 });
	return transaction;
});

const getTransactionById = Asyncly(async (id) => {
	const transaction = await Transaction.findById(id);
	if (!transaction) {
		throw new ApiError(httpStatus.NOT_FOUND, 'Transaction not found');
	}
	return transaction;
});

// const createTransaction = Asyncly(async (transactionBody) => {
// 	const transaction = await Transaction.create(transactionBody);
// 	return transaction;
// });

/**const initiatePaystackTransaction = async (req, res) => {
	let paymentPayload = {};
	const { orderId } = req.body;

	try {
		//const order = await Order.findOne({ _id: orderId }).populate('userId');
		const order = await Order.findOne({ orderId }).populate('userId');

		if (!order) {
			return res
				.status(httpStatus.BAD_REQUEST)
				.json({ error: 'Order not found' });
		}

		const { userId, orderTotal, deliveryFee, serviceFee, paymentMethod } =
			order;
		const totalAmount = orderTotal + serviceFee + deliveryFee;

		paymentPayload = {
			email: userId.email,
			amount: totalAmount * 100,
			channels: [paymentMethod],
			callback_url: 'https://meet.google.com/',
			currency: 'NGN',
		};
	} catch (error) {
		console.error(error);
		return res
			.status(httpStatus.INTERNAL_SERVER_ERROR)
			.json({ error: 'Internal Server Error' });
	}

	const headers = {
		Authorization: `Bearer ${apiKey}`,
		'Content-Type': 'application/json',
	};

	const body = paymentPayload;

	try {
		const url = process.env.PAYSTACK_URL;
		const response = await axios.post(url, body, { headers });
		const responseData = response.data;
		res.json(responseData);
	} catch (err) {
		console.log(err);
		res
			.status(httpStatus.INTERNAL_SERVER_ERROR)
			.json({ error: 'Paystack initialization failed' });
	}
};*/

const verifyTransaction = async (req, res) => {
	try {
		const { reference } = req.params;
		const userId = req.user.id;

		const headers = {
			Authorization: `Bearer ${apiKey}`,
		};

		const url = 'https://api.paystack.co/transaction/verify/';

		const response = await axios.get(`${url}${reference}`, { headers });

		const transactionData = response.data;

		if (transactionData.data.status !== 'success') {
			return res.status(400).json({
				error: transactionData.data.gateway_response,
				status: transactionData.data.status,
			});
		}

		const { amount } = transactionData.data;

		const paidAmount = amount / 100;

		const order = await Order.findOne({ userId })
			.sort({ orderDate: -1 })
			.populate('userId');

		if (paidAmount < order.grandTotal) {
			return res
				.status(httpStatus.BAD_REQUEST)
				.json({ error: 'Paid amount is not equal to order total' });
		}

		order.paymentStatus = 'Completed';

		await order.save();

		// Save transaction details in the transaction Schema
		const transaction = await Transaction.create({
			amount: paidAmount,
			status: 'Successful',
			reference,
			transactionType: 'Card',
			userId,
		});

		if (order.userId && order.userId.fcmToken) {
			const notification = {
				title: 'Payment Confirmed',
				body: 'Your payment has been successfully confirmed!. Your order is now being processed and will be on its way soon',
			};
			const pushNotification = await sendPushNotification(
				order.userId.fcmToken,
				notification,
			);
		}

		// Send notification to the restaurant
		if (order.restaurantId) {
			const restaurant = await Restaurant.findById(order.restaurantId);
			if (restaurant && restaurant.fcm_device_token) {
				const notificationToRestaurant = {
					title: 'New Order Received!',
					body: `New order received from ${order.userId.username}. Please check your dashboard for details.`,
				};
				const pushNotificationToRestaurant = await sendPushNotification(
					restaurant.fcm_device_token,
					notificationToRestaurant,
				);
			}
		}

		return res.status(200).json({
			status: 'success',
			data: transaction,
			message: 'Order has been received and payment confirmed',
		});
	} catch (err) {
		logger.error(`Failed to verify transaction ${err}`);
		return res.status(500).json({ error: `An error occurred: ${err}` });
	}
};

const getCustomerDedicatedVirtualAccount = async (req, res) => {
	try {
		const { userId } = req.params;
		const user = await User.findById(userId);

		const { email } = user;
		const url = `https://api.paystack.co/customer/${email}`;

		const headers = {
			Authorization: `Bearer ${apiKey}`,
		};
		const response = await axios.get(url, { headers });

		const responseData = response.data;

		if (!responseData || responseData.status !== true) {
			return res
				.status(httpStatus.NOT_FOUND)
				.json({ message: `Error retrieving user Dedicated Virtual Account` });
		}

		//console.log(responseData.data);

		const dva = await User.findOneAndUpdate(
			{ email },
			{
				$set: {
					'wallet.accountNumber':
						responseData.data.dedicated_account.account_number,
					'wallet.accountName':
						responseData.data.dedicated_account.account_name,
					'wallet.bankName': responseData.data.dedicated_account.bank.name,
				},
			},
			{
				new: true,
			},
		);

		return res.status(httpStatus.OK).json({ data: dva });
	} catch (err) {
		logger.error(`Failed to fetch customer Virtual account details ${err}`);
		return res
			.status(httpStatus.INTERNAL_SERVER_ERROR)
			.json({ error: 'An error occured' });
	}
};

const paystackWebHook = async (req, res) => {
	try {
		const hash = crypto
			.createHmac('sha512', apiKey)
			.update(JSON.stringify(req.body))
			.digest('hex');
		if (hash !== req.headers['x-paystack-signature']) {
			return res.status(httpStatus.UNAUTHORIZED).send('Invalid Signature');
		}
		const { event, data } = req.body;
		if (event) {
			logger.info(`Paystack event ${event}`);
			res.status(200);
		}
		//const user = await User.findOne({ email: data.email });
		if (event === 'dedicatedaccount.assign.success') {
			await User.findOneAndUpdate(
				{ email },
				{
					$set: {
						'wallet.accountNumber':
							responseData.data.dedicated_account.account_number,
						'wallet.accountName':
							responseData.data.dedicated_account.account_name,
						'wallet.bankName': responseData.data.dedicated_account.bank.name,
					},
				},
				{
					new: true,
				},
			);
		}

		if (event === 'charge.success') {
			console.log(event);
			const userEmail = data.customer.email;
			const { amount, reference } = data;
			const user = await User.findOne({ email: userEmail });

			// Check if the transaction has already been processed
			const existingTransaction = await Transaction.findOne({ reference });
			if (existingTransaction) {
				console.log('Transaction already processed');
				return res.status(httpStatus.OK).send('Transaction already processed');
			}

			// Divide the amount by 100 to convert it to the base currency
			const amountInBaseCurrency = amount / 100;

			const newUserBalance = amountInBaseCurrency + user.wallet.balance;

			user.wallet.balance = newUserBalance;

			await user.save();

			// Save transaction details in the transaction Schema
			await Transaction.create({
				amount: amountInBaseCurrency,
				status: 'Successful',
				reference,
				transactionType: 'Transfer',
				transactionName: 'Topup',
				userId: user._id,
			});

			// Uncomment when the fcm token has been fixed
			const notification = `You have successfully topped up your wallet with ${amountInBaseCurrency} NGN`;

			// await sendPushNotification(fcm_device_token, notification);
		}

	} catch (err) {
		logger.error(`An error occured ${err}`);
		return res.status(500).send('An error occured');
	}
};


const getAllTransactionsByUserId = async (req, res) => {
	try {
		const { userId } = req.params; // Assuming userId is passed as a parameter
		const transactions = await Transaction.find({ userId }).sort({
			createdAt: -1,
		});
		res.status(200).json({ success: true, data: transactions });
	} catch (error) {
		console.error('Error fetching transactions by user:', error.message);
		res
			.status(500)
			.json({ success: false, error: 'Error fetching transactions' });
	}
};

module.exports = {
	getAllTransactions,
	getTransactionById,
	verifyTransaction,
	getCustomerDedicatedVirtualAccount,
	paystackWebHook,
	getAllTransactionsByUserId,
};
