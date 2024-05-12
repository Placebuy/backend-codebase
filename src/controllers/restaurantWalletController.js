// walletController.js

const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const RestaurantWallet = require('../models/restaurantWallet');
const Restaurant = require('../models/restaurant');
const Company = require('../models/company');
const cloudinary = require('cloudinary').v2;
const sendEmail = require('../helpers/sendMail');


// Function to generate a random 5-digit number
function generateTransactionId() {
    return Math.floor(10000 + Math.random() * 90000);
}
// Controller function to handle restaurant withdrawals
exports.withdraw = async (req, res) => {
    try {
        const { restaurantId } = req.params; // Extract restaurant ID from request parameters
        const { accountNumber, accountName, bankName, withdrawalAmount } = req.body;
        
        if (restaurantId !== req.user.id) {
            return res.status(httpStatus.UNAUTHORIZED).json({ message: 'Unauthorized' });
        }
        
        // Find the restaurant wallet by restaurant ID
        const restaurantWallet = await RestaurantWallet.findOne({ restaurant: restaurantId });

        if (!restaurantWallet) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Restaurant wallet not found');
        }

        // Check if the available balance is sufficient for the withdrawal
        if (restaurantWallet.availableBalance < withdrawalAmount) {
            throw new ApiError(httpStatus.BAD_REQUEST, 'Insufficient balance');
        }

        // Generate a unique transaction ID
        const transactionId = generateTransactionId();

        // Deduct the withdrawal amount from available balance
        restaurantWallet.availableBalance -= withdrawalAmount;

        // Add the withdrawal details to the withdrawals array including the transactionId
        restaurantWallet.withdrawals.push({
            accountNumber,
            accountName,
            bankName,
            withdrawalAmount,
            transactionId // Store the transaction ID
        });

        // Save the updated restaurant wallet
        await restaurantWallet.save();

        res.status(httpStatus.OK).json({ status: true, message: 'Withdrawal successful', transactionId });
    } catch (error) {
        console.error("Error withdrawing:", error);
        res.status(error.status || httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message || 'Internal server error' });
    }
};




exports.getRecentAccountDetails = async (req, res) => {
  try {
    const { restaurantId } = req.params; // Assuming the restaurant ID is provided in the request parameters

    const recentAccountDetails = await RestaurantWallet.findOne({ restaurant: restaurantId })
      .sort({ createdAt: -1 }) // Sort in descending order by creation date
      .populate('restaurant', 'name email')
      .populate({
        path: 'withdrawals',
        match: { status: { $ne: 'reversed' } }, // Exclude reversed transactions
        select: 'accountNumber accountName withdrawalAmount bankName status date',
        options: { sort: { date: -1 } } // Sort withdrawals by date in descending order
      })
      .select('-movedBalanceTransactions'); // Exclude the movedBalanceTransactions field

    // If no recentAccountDetails found for the provided restaurant ID
    if (!recentAccountDetails) {
      return res.status(httpStatus.NOT_FOUND).json({ message: 'Recent account details not found for the provided restaurant ID' });
    }

    // Modify withdrawals to include only unique entries and limit to 3
    const uniqueWithdrawals = [];
    const uniqueAccounts = new Set();

    recentAccountDetails.withdrawals.forEach(withdrawal => {
      const key = withdrawal.accountNumber + withdrawal.accountName;

      // Only include withdrawals with unique account number and name combinations
      if (!uniqueAccounts.has(key) && uniqueWithdrawals.length < 3) {
        uniqueWithdrawals.push(withdrawal);
        uniqueAccounts.add(key);
      }
    });

    recentAccountDetails.withdrawals = uniqueWithdrawals;

    res.status(httpStatus.OK).json(recentAccountDetails);
  } catch (error) {
    console.error("Error getting recent account details:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
  }
};






// Controller function to get available balance and swift balance
exports.getBalances = async (req, res) => {
    try {
        const { restaurantId } = req.params;

        // Check if the requested restaurant ID matches the ID in the token
        if (!restaurantId ) {
            return res.status(httpStatus.UNAUTHORIZED).json({ message: 'Unauthorized access to balance' });
        }

        // Find the restaurant wallet by restaurant ID
        const restaurantWallet = await RestaurantWallet.findOne({ restaurant: restaurantId });

        if (!restaurantWallet) {
            return res.status(httpStatus.NOT_FOUND).json({ message: 'Restaurant wallet not found' });
        }

        res.status(httpStatus.OK).json({
            availableBalance: restaurantWallet.availableBalance,
            swiftBalance: restaurantWallet.swiftWallet
        });
    } catch (error) {
        console.error("Error getting balances:", error);
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
};

exports.getPendingWithdrawals = async (req, res) => {
  try {
      const allRestaurantWallets = await RestaurantWallet.find().populate({
          path: 'restaurant',
          select: 'restaurantName' // Select the restaurantName field to populate
      });

      let pendingWithdrawals = [];

      allRestaurantWallets.forEach(wallet => {
          const pendingWithdrawalsForWallet = wallet.withdrawals.filter(withdrawal => withdrawal.status === 'pending');

          pendingWithdrawalsForWallet.forEach(withdrawal => {
              withdrawal.restaurantName = wallet.restaurant ? wallet.restaurant.restaurantName : null; // Populate restaurantName
          });

          pendingWithdrawals.push(...pendingWithdrawalsForWallet);
      });

      console.log("Pending Withdrawals:", pendingWithdrawals); // Log pendingWithdrawals to inspect its contents

      // Check if there are no pending withdrawals
      if (pendingWithdrawals.length === 0) {
          // If there are no pending withdrawals, return an empty array as the response
          return res.status(httpStatus.OK).json([]);
      }

      // Return the pending withdrawals as a response
      res.status(httpStatus.OK).json(pendingWithdrawals);
  } catch (error) {
      console.error("Error getting pending withdrawals:", error);
      res.status(error.status || httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message || 'Internal server error' });
  }
};






  
exports.updateWithdrawalStatus = async (req, res) => {
    try {
      const { withdrawalId } = req.params;
  
      // Find the restaurant wallet document
      const restaurantWallet = await RestaurantWallet.findOne({ 'withdrawals._id': withdrawalId });
  
      if (!restaurantWallet) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Restaurant wallet not found');
      }
  
      // Find the withdrawal document within the withdrawals array
      const withdrawal = restaurantWallet.withdrawals.id(withdrawalId);
  
      if (!withdrawal) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Withdrawal not found');
      }
  
      // Check if receipt image is provided
      if (!req.files || !req.files.image) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'No receipt image provided');
      }
  
      // Upload the receipt image to Cloudinary
      const { secure_url: receiptImage } = await cloudinary.uploader.upload(
        req.files.image.tempFilePath,
        {
          use_filename: true,
          folder: 'Receipts',
        }
      );
  
      // Save the receipt image URL to the withdrawal
      withdrawal.image = receiptImage;
  
      // Update the withdrawal status to "sent"
      withdrawal.status = 'sent';
  
      // Save the updated restaurant wallet
      await restaurantWallet.save();
  
      // Send email notification to the restaurant
      const restaurant = await Restaurant.findById(restaurantWallet.restaurant);
      const subject = 'Withdrawal Status Update';
      const message = `
        <h1>Withdrawal Request Processed</h1>
        <p>Your withdrawal request for ${withdrawal.withdrawalAmount} has been processed successfully.</p>
        <p>Status: ${withdrawal.status}</p>
        <p>Reaceipt: ${withdrawal.image}</p>
        <p>Thank you for using our service!</p>
      `;
  
      await sendEmail({
        to: restaurant.email,
        subject: subject,
        text: message,
      });
  
      res.status(httpStatus.OK).json({ success: true, message: 'Withdrawal status updated to "sent" successfully' });
    } catch (error) {
      console.error('Error updating withdrawal status:', error.message);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, error: 'Error updating withdrawal status' });
    }
  };
  
  
  
  
  



  

  
exports.getRestaurantsWithMoney = async (req, res, next) => {
    try {
      // Find all restaurant wallets where swiftWallet balance is greater than 0
      const restaurants = await RestaurantWallet.find({ swiftWallet: { $gt: 0 } });
  
      res.status(httpStatus.OK).json(restaurants);
    } catch (error) {
      console.error('Error fetching restaurants with money:', error);
      next(error);
    }
  };


  exports.deductMoneyFromRestaurantWallet = async (req, res) => {
      try {
          const { restaurantId } = req.params;
          const { deductionAmount } = req.body;
  
          // Find the restaurant wallet by its ID
          const restaurantWallet = await RestaurantWallet.findById(restaurantId);
  
          // Check if the restaurant wallet exists
          if (!restaurantWallet) {
              return res.status(404).json({ message: 'Restaurant wallet not found' });
          }
  
          // Deduct the specified amount from the Swift wallet
          restaurantWallet.swiftWallet -= deductionAmount;
  
          // Save the updated wallet balance
          await restaurantWallet.save();
  
          return res.status(200).json(restaurantWallet);
      } catch (error) {
          console.error(`Error deducting money from restaurant wallet:`, error);
          return res.status(500).json({ message: 'Failed to deduct money from restaurant wallet' });
      }
  };
  

  exports.getAllRestaurantWithdrawals = async (req, res) => {
    try {
        const { restaurantId } = req.params;
        
        // Find the restaurant wallet by restaurant ID and populate the 'restaurant' field with the 'restaurantName'
        const restaurantWallet = await RestaurantWallet.findOne({ restaurant: restaurantId })
            .populate('restaurant', 'restaurantName');
    
        if (!restaurantWallet) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Restaurant wallet not found');
        }
    
        // Retrieve all withdrawals and sort them by date in descending order
        const withdrawals = restaurantWallet.withdrawals
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .map(withdrawal => ({
                ...withdrawal.toObject(),
                date: withdrawal.date // Include the date field in the response
            }));
    
        res.status(httpStatus.OK).json({ withdrawals });
    } catch (error) {
        console.error("Error getting withdrawals:", error);
        res.status(error.status || httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message || 'Internal server error' });
    }
};




exports.deductMoneyFromRestaurantWallet = async (req, res) => {
    try {
        const { walletId } = req.params;
        const { deductionAmount } = req.body;

        // Find the restaurant wallet by its ID
        const restaurantWallet = await RestaurantWallet.findById(walletId);

        // Check if the restaurant wallet exists
        if (!restaurantWallet) {
            return res.status(404).json({ message: 'Restaurant wallet not found' });
        }

        // Deduct the specified amount from the Swift wallet
        restaurantWallet.swiftWallet -= deductionAmount;

        // Save the updated wallet balance
        await restaurantWallet.save();

        return res.status(200).json(restaurantWallet);
    } catch (error) {
        console.error(`Error deducting money from restaurant wallet:`, error);
        return res.status(500).json({ message: 'Failed to deduct money from restaurant wallet' });
    }
};


exports.reverseWithdrawal = async (req, res) => {
    try {
      const { restaurantId, withdrawalId } = req.params;
  
      const restaurantWallet = await RestaurantWallet.findOne({ restaurant: restaurantId });
        
      if (!restaurantWallet) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Restaurant wallet not found');
      }
  
      // Find the withdrawal by its ID
      const withdrawal = restaurantWallet.withdrawals.find(w => w._id.toString() === withdrawalId);
  
      if (!withdrawal) {
        console.error('Withdrawal not found:', withdrawalId);
        throw new ApiError(httpStatus.NOT_FOUND, 'Withdrawal not found');
      }
  
      // Add the withdrawal amount back to available balance
      restaurantWallet.availableBalance += withdrawal.withdrawalAmount;
  
      // Update the withdrawal status to "reversed"
      withdrawal.status = 'reversed';
  
      // Save the updated restaurant wallet
      await restaurantWallet.save();
  
      res.status(httpStatus.OK).json({ status: true, message: 'Withdrawal reversed successfully' });
    } catch (error) {
      console.error("Error reversing withdrawal:", error);
      res.status(error.status || httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message || 'Internal server error' });
    }
  };
  exports.getMovedSwiftWalletBalance = async (req, res) => {
    try {
        // Retrieve the restaurant ID from the request parameters
        const { restaurantId } = req.params;

        // Query the database to find the restaurant wallet by its ID
        const restaurantWallet = await RestaurantWallet.findOne({ restaurant: restaurantId });

        if (!restaurantWallet) {
            // If the restaurant wallet is not found, return a 404 Not Found response
            return res.status(httpStatus.NOT_FOUND).json({ message: 'Restaurant wallet not found' });
        }

        // Extract the moved balance transactions from the restaurant wallet and sort them by date in descending order
        const movedBalanceTransactions = restaurantWallet.movedBalanceTransactions
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        // Check if there are no moved balance transactions
        if (!movedBalanceTransactions.length) {
            // If there are no moved transactions, return an empty array as the response
            return res.status(httpStatus.OK).json({ movedBalanceTransactions: [] });
        }

        // Return the moved balance transactions as a response
        res.status(httpStatus.OK).json({ movedBalanceTransactions });
    } catch (error) {
        // If an error occurs, return a 500 Internal Server Error response
        console.error('Error fetching moved swift wallet balance:', error);
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
};

