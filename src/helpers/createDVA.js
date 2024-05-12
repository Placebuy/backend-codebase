const axios = require('axios');
const logger = require('../config/logger');
require('dotenv').config();

const apiKey = process.env.PAYSTACK_KEY;

const createDedicatedVirtualAccount = async (
	email,
	firstName,
	lastName,
	phoneNumber,
) => {
	try {
		const body = {
			email,
			first_name: firstName,
			last_name: lastName,
			middle_name: 'Karen',

			phone: phoneNumber,
			preferred_bank: 'wema-bank',
			country: 'NG',
		};

		//console.log('Request Body:', body);

		const headers = {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		};

		const url = 'https://api.paystack.co/dedicated_account/assign';
		const response = await axios.post(url, body, { headers });
		const responseData = response.data;

		if (!responseData || responseData.status !== true) {
			throw new Error('Failed to create Dedicated Virtual Account');
		}
		return responseData;
	} catch (err) {
		logger.error(`Failed to create Dedicated Virtual account ${err}`);
		throw err;
	}
};

module.exports = createDedicatedVirtualAccount;
