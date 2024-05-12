const httpStatus = require('http-status');
const mongoose = require('mongoose');

class ApiError extends Error {
	constructor(
		statusCode = httpStatus.INTERNAL_SERVER_ERROR,
		message,
		isOperational = true,
		stack = '',
		validation = false,
	) {
		super(message);

		if (validation) {
			this.message = typeof message === 'string' ? JSON.parse(message) : message;
		}

		this.statusCode = statusCode;
		this.isOperational = isOperational;

		if (stack) {
			this.stack = stack;
		} else {
			Error.captureStackTrace(this);
		}
	}

	toJSON() {
		return {
			status: this.statusCode,
			message: this.message,
			isOperational: this.isOperational,
			stack: this.stack,
		};
	}
}

module.exports = ApiError;
