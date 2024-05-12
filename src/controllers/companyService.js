const httpStatus = require('http-status');
const { v4: uuidv4 } = require('uuid');
const ApiError = require('../utils/ApiError');
const RestaurantWallet = require('../models/restaurantWallet');
const Order = require('../models/order');
const {
	Company,
	MovedSwiftTransactions,
	SentPendingbal,
} = require('../models/company');
const User = require('../models/userRoleModel');
const Transaction = require('../models/transaction');
const cloudinary = require('cloudinary').v2;
const Asyncly = require('../utils/Asyncly');

// Function to generate a short UUID synchronously
const generateShortUuid = () => uuidv4().substr(0, 6);

const moveSwiftBalance = Asyncly(async (req, res) => {
	const restaurantWallets = await RestaurantWallet.find({
		cleared: true,
		swiftWallet: { $gt: 0 },
	});
	let totalMovedAmount = 0;
	const invoiceId = generateShortUuid(); // Generate a single invoice ID for all transactions

	for (const wallet of restaurantWallets) {
		const hasConfirmedOrders = await Order.exists({
			restaurantId: wallet.restaurant,
			orderStatus: { $in: ['CONFIRMED', 'PICK UP SOON'] },
		});

		if (hasConfirmedOrders) {
			wallet.cleared = false;
			await wallet.save();
		} else {
			const amountMoved = wallet.swiftWallet;
			wallet.availableBalance += amountMoved;
			wallet.swiftWallet = 0;

			totalMovedAmount += amountMoved;

			wallet.movedBalanceTransactions.push({
				invoiceId,
				amountMoved,
				date: new Date(),
			});

			await wallet.save();
		}
	}

	const movedSwiftTransaction = new MovedSwiftTransactions();
	movedSwiftTransaction.amountMoved = totalMovedAmount;
	movedSwiftTransaction.admin = req.user.id;
	movedSwiftTransaction.invoiceID = invoiceId;
	await movedSwiftTransaction.save();

	const company = await Company.findOne();
	if (company) {
		company.totalRestauransbal += totalMovedAmount;
		company.totalSwiftBal -= totalMovedAmount;
		await company.save();
	}

	res.status(httpStatus.OK).json({
		status: true,
		message: 'Swift wallet balance moved to available balance successfully',
		totalMovedAmount,
	});
});

const getAllMovedTransactions = Asyncly(async (req, res) => {
	const { invoiceId } = req.params;

	const restaurantWallets = await RestaurantWallet.find({
		'movedBalanceTransactions.invoiceId': invoiceId,
	}).populate({
		path: 'restaurant',
		select: 'restaurantName image',
	});

	const movedTransactions = [];
	restaurantWallets.forEach((wallet) => {
		wallet.movedBalanceTransactions.forEach((transaction) => {
			if (transaction.invoiceId === invoiceId) {
				movedTransactions.push({
					invoiceId: transaction.invoiceId,
					amountMoved: transaction.amountMoved,
					date: transaction.date,
					restaurantName: wallet.restaurant.restaurantName,
					restaurantImage: wallet.restaurant.image,
					_id: transaction._id,
				});
			}
		});
	});

	res.status(httpStatus.OK).json({ status: true, movedTransactions });
});

const createSendRestaurantbal = Asyncly(async (req, res) => {
	const { amountSent } = req.body;

	if (!req.files || !req.files.image) {
		throw new ApiError(httpStatus.BAD_REQUEST, 'No receipt image provided');
	}

	const { secure_url } = await cloudinary.uploader.upload(
		req.files.image.tempFilePath,
		{
			use_filename: true,
			folder: 'Restaurantbal',
		},
	);
	const invoiceID = generateShortUuid();

	const newSentPendingbal = new SentPendingbal({
		amountSent,
		invoiceID,
		image: secure_url,
	});

	await newSentPendingbal.save();

	res.status(httpStatus.CREATED).json({
		success: true,
		message: 'SentPendingbal entry created successfully',
		data: newSentPendingbal,
	});
});

const updateApprovedStatus = Asyncly(async (req, res) => {
	const { id } = req.params;

	const sentPendingbal = await SentPendingbal.findById(id);

	if (!sentPendingbal) {
		return res
			.status(httpStatus.NOT_FOUND)
			.json({ success: false, error: 'SentPendingbal entry not found' });
	}

	if (sentPendingbal.approved) {
		return res.status(200).json({
			success: true,
			message: 'Already approved',
			data: sentPendingbal,
		});
	}

	sentPendingbal.approved = true;

	await sentPendingbal.save();

	const company = await Company.findOne();
	if (company) {
		company.pendingRestauransbal -= parseInt(sentPendingbal.amountSent);
		await company.save();
	}

	res.status(httpStatus.OK).json({
		success: true,
		message: 'Approved status updated successfully',
		data: sentPendingbal,
	});
});

const topUpWallet = Asyncly(async (req, res) => {
	const { userId } = req.params;
	const { amount } = req.body;

	const user = await User.findById(userId);
	if (!user) {
		return res
			.status(httpStatus.BAD_REQUEST)
			.json({ success: false, error: 'User not found' });
	}

	user.wallet.balance += amount;
	await user.save();

	const transaction = new Transaction({
		userId: userId,
		amount: amount,
		transactionType: 'Transfer',
		transactionName: 'Topup',
		status: 'Successful',
		reference: generateTransactionReference(),
	});
	await transaction.save();

	res
		.status(httpStatus.OK)
		.json({ success: true, message: 'Wallet topped up successfully' });
});

// Function to generate a unique transaction reference (you can implement your own logic here)
function generateTransactionReference() {
	return (
		Math.random().toString(36).substring(2, 15) +
		Math.random().toString(36).substring(2, 15)
	);
}

module.exports = {
	moveSwiftBalance,
	getAllMovedTransactions,
	createSendRestaurantbal,
	updateApprovedStatus,
	topUpWallet,
};
