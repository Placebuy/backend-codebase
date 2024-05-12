const httpStatus = require('http-status');
const Asyncly = require('../utils/Asyncly');
const ApiError = require('../utils/ApiError');
const { DynamicAddress } = require('../models/location');

// Create a new address for a user
const createAddress = Asyncly(async (req, res) => {
	// Extract userid from the request body or wherever it's supposed to come

	const { userid, ...otherFields } = req.body;

	// Check if userid is present, you might want to handle this case appropriately
	if (!userid) {
		return res
			.status(httpStatus.BAD_REQUEST)
			.json({ message: 'User ID is required' });
	}

	const address = new DynamicAddress({
		userid,
		...otherFields,
	});

	await address.save();
	res.status(httpStatus.OK).json({ message: 'Address Created' });
});

// Update an existing address for a user (commented out as it's not used)
// const updateAddress = async (userId, data) => {
//   try {
//     const address = await DynamicAddress.findOneAndUpdate(
//       { user: userId },
//       { $set: data },
//       { new: true, upsert: true }
//     );
//     return address;
//   } catch (error) {
//     throw new Error(`Error updating address: ${error.message}`);
//   }
// };

// Get address by ID
const getAddress = Asyncly(async (req, res) => {
	const { id: userid } = req.params;

	const address = await DynamicAddress.aggregate([{ $match: { userid } }])
		.sort({ createdAt: -1 })
		.limit(1);

	if (!address.length) {
		throw new ApiError(httpStatus.NOT_FOUND, 'Address not found');
	}

	res.status(httpStatus.OK).json(address);
});

// Get recent addresses for a user
const getRecentAddresses = Asyncly(async (req, res) => {
	const { id: userid } = req.params;

	const addresses = await DynamicAddress.aggregate([
			{ $match: { userid } },
			{ $sort: { createdAt: -1 } },
			{ $group: {
					_id: "$userid",
					addresses: {
							$push: {
									_id: "$_id",
									address: "$address",
									longitude: "$longitude",
									latitude: "$latitude",
									country: "$country",
									state: "$state",
									code: "$code",
									createdAt: "$createdAt",
									updatedAt: "$updatedAt",
									__v: "$__v",
							}
					}
			}},
			{ $project: { _id: 0, userid: "$_id", addresses: 1 } }, // Project to reshape the output
			{ $unwind: "$addresses" }, // Unwind the addresses array
			{ $sort: { "addresses.createdAt": -1 } }, // Sort addresses within each group
			{ $limit: 3 }, // Limit to 3 addresses
	]);

	res.status(httpStatus.OK).json(addresses);
});


module.exports = {
	createAddress,
	getAddress,
	getRecentAddresses,
};
