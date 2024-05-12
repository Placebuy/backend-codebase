// Import the necessary libraries
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
	userId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
	},
	amount: {
		type: Number,
		required: true,
	},
	transactionType: {
		type: String,
		enum: ['Card', 'Transfer',],
		
	},
	transactionName: {
		type: String,
		enum: ['Topup', 'Order', ],
		
	},
	orderId: {
		type: String,
	},
	reference: {
		type: String,
		required: true,
		unique: true,
	},
	status: {
		type: String,
		enum: ['Pending', 'Successful', 'Failed'],
		default: 'Pending',
	},
	timestamp: {
		type: Date,
		default: Date.now,
	},
});

// Create a Transaction model based on the schema
const Transaction = mongoose.model('Transaction', transactionSchema);

// Export the Transaction model
module.exports = Transaction;
