const axios = require('axios');
const logger = require('../config/logger');
require('dotenv').config();

const apiKey = process.env.PAYSTACK_SECRET_KEY;
const url = process.env.PAYSTACK_URL;

const initiatePaystackTransaction = async (email, amount) => {
	try {
		const paymentPayload = {
			email: email,
			amount: amount,
			channels: ['Card'],
			callback_url: 'https://meet.google.com/',
			currency: 'NGN',
		};
		const headers = {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		};

		const body = paymentPayload;

		const response = await axios.post(url, body, { headers });
		const responseData = response.data;
		return responseData;
	} catch (err) {
		logger.error(`An error occured while initializing payment ${err}`);
		throw err;
	}
};

module.exports = initiatePaystackTransaction;
