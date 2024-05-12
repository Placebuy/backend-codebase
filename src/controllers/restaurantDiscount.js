const mongoose = require('mongoose');
const cron = require('node-cron');
const RestaurantDiscount = require('../models/restaurantDiscount');
const Food = require('../models/food');

const Restaurant = require('../models/restaurant');

exports.getAllMenuDiscounts = async (req, res) => {
  try {
      const currentDate = new Date();

      // Find all discounts where the discountType is "allMenu"
      const discounts = await RestaurantDiscount.find({
          discountType: 'allMenu',
          startDate: { $lte: currentDate }, // Check if the current date is on or after the start date
          endDate: { $gte: currentDate } // Check if the current date is on or before the end date
      }).populate({
          path: 'restaurantId',
          // select: 'restaurantName image longitude latitude' // Include latitude and longitude fields
      });

      const clientLongitude = parseFloat(req.query.longitude);
      const clientLatitude = parseFloat(req.query.latitude);

      // Calculate distance for each discount restaurant
      const discountsWithDistance = discounts.map(discount => {
          const restaurant = discount.restaurantId;
          if (restaurant && restaurant.longitude !== undefined && restaurant.latitude !== undefined && !isNaN(restaurant.longitude) && !isNaN(restaurant.latitude)) {
              const distance = getDistance(clientLatitude, clientLongitude, restaurant.latitude, restaurant.longitude);
              return { ...discount.toObject(), distance }; // Include distance in the object
          } else {
              return { ...discount.toObject(), distance: null }; // If coordinates are not valid, set distance to null
          }
      });

      res.status(200).json({ discounts: discountsWithDistance });
  } catch (error) {
      console.error('Error fetching discounts:', error);
      res.status(500).json({ error: 'Internal server error' });
  }
};



function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance;
}

// Function to convert degrees to radians
function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

// Function to create a restaurant discount
exports.createRestaurantDiscount = async (req, res) => {
  try {
    const { restaurantId, title, startDate, endDate, discountType, selectedMenuItems } = req.body;
    const discount = req.body.discount ? parseFloat(req.body.discount) / 100 : 0;

    

    if (discountType === 'allMenu') {
      console.log('Updating discounts for all foods associated with the restaurant...');
      await Food.updateMany({ restaurant: restaurantId }, { discount });
    } else if (discountType === 'selectMenu' && selectedMenuItems && selectedMenuItems.length > 0) {
      console.log('Updating discounts for foods with selected menu items...');
      await Food.updateMany({ menus: { $in: selectedMenuItems } }, { discount });
    } 

    const restaurantDiscount = new RestaurantDiscount({
      restaurantId,
      title, 
      startDate,
      endDate,
      discount,
      discountType,
      selectedMenuItems 
    }); 

    await restaurantDiscount.save();

    res.status(201).json({ message: 'Restaurant discount created successfully' });
  } catch (error) {
    console.error('Error creating restaurant discount:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};



// exports.getAllMenuDiscounts = async (req, res) => {
//     try {
//         const currentDate = new Date();

//         // Find all discounts where the discountType is "allMenu"
//         const discounts = await RestaurantDiscount.find({
//             discountType: 'allMenu',
//             startDate: { $lte: currentDate }, // Check if the current date is on or after the start date
//             endDate: { $gte: currentDate } // Check if the current date is on or before the end date
//         }).populate({
//             path: 'restaurantId',
//             // select: 'restaurantName image'
//         });

//         res.status(200).json({ discounts });
//     } catch (error) {
//         console.error('Error fetching discounts:', error);
//         res.status(500).json({ error: 'Internal server error' });
//     }
// };

  


exports.editRestaurantDiscount = async (req, res) => {
  try {
    const { discountId } = req.params;
    const { title, startDate, endDate, discount, discountType, selectedMenuItems } = req.body;

    const isValidDiscountId = mongoose.Types.ObjectId.isValid(discountId);

    if (!isValidDiscountId) {
      return res.status(400).json({ error: 'Invalid discount ID' });
    }

    const updatedDiscount = await RestaurantDiscount.findByIdAndUpdate(
      discountId,
      { title, startDate, endDate, discount, discountType, selectedMenuItems },
      { new: true } 
    );

    // Reschedule cron jobs for updated start and end dates
    rescheduleStartDiscount(updatedDiscount._id, startDate);
    rescheduleEndDiscount(updatedDiscount._id, endDate);

    res.status(200).json({ message: 'Restaurant discount updated successfully', data: updatedDiscount });
  } catch (error) {
    console.error('Error updating restaurant discount:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.deleteRestaurantDiscount = async (req, res) => {
  try {
    const { discountId } = req.params;

    const isValidDiscountId = mongoose.Types.ObjectId.isValid(discountId);

    if (!isValidDiscountId) {
      return res.status(400).json({ error: 'Invalid discount ID' });
    }

    // Cancel scheduled cron jobs for the discount
    cancelScheduledJobs(discountId);

    await RestaurantDiscount.findByIdAndDelete(discountId);

    res.status(200).json({ message: 'Restaurant discount deleted successfully' });
  } catch (error) {
    console.error('Error deleting restaurant discount:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Function to start the discount
const startDiscount = async (discountId) => {
  try {
    // Fetch the discount details from the database
    const discount = await RestaurantDiscount.findById(discountId);

    if (!discount) {
      console.error(`Discount ${discountId} not found.`);
      return;
    }

    // Logic to apply the discount to relevant menu items or any other actions
    if (discount.discountType === 'allMenu') {
      // Update all discounts associated with the restaurant ID
      await Food.updateMany({ restaurantId: discount.restaurantId }, { discount: discount.discount });
    } else if (discount.discountType === 'selectMenu' && discount.selectedMenuItems && discount.selectedMenuItems.length > 0) {
      await Food.updateMany({ menuId: { $in: discount.selectedMenuItems } }, { discount: discount.discount });
    }

    console.log(`Discount ${discountId} started.`);
  } catch (error) {
    console.error(`Error starting discount ${discountId}:`, error);
  }
};
// Function to schedule cron job to start the discount
const scheduleStartDiscount = (discountId, startDate) => {
  // Parse the startDate to ensure it's in the correct format for node-cron
  const cronStartDate = new Date(startDate).toISOString();

  cron.schedule(cronStartDate, () => {
    startDiscount(discountId);
  }, {
    timezone: 'Africa/Lagos', // Replace with your timezone
  });
};

// Function to schedule cron job to end the discount
const scheduleEndDiscount = (discountId, endDate) => {
  // Parse the endDate to ensure it's in the correct format for node-cron
  const cronEndDate = new Date(endDate).toISOString();

  cron.schedule(cronEndDate, () => {
    endDiscount(discountId);
  }, {
    timezone: 'Africa/Lagos', // Replace with your timezone
  });
};


  

// Function to end the discount
const endDiscount = async (discountId) => {
  try {
    // Fetch the discount details from the database
    const discount = await RestaurantDiscount.findById(discountId);

    if (!discount) {
      console.error(`Discount ${discountId} not found.`);
      return;
    } 

    // Logic to revert the discount on relevant menu items or any other actions
    if (discount.discountType === 'allMenu') {
      await Food.updateMany({ restaurantId: discount.restaurantId }, { discount: 0 });
    } else if (discount.discountType === 'selectMenu' && discount.selectedMenuItems && discount.selectedMenuItems.length > 0) {
      await Food.updateMany({ menuId: { $in: discount.selectedMenuItems } }, { discount: 0 });
    }

    console.log(`Discount ${discountId} ended.`);
  } catch (error) {
    console.error(`Error ending discount ${discountId}:`, error);
  }
};


// Function to reschedule cron job for updated start date
const rescheduleStartDiscount = (discountId, startDate) => {
  // Cancel existing cron job for start date
  cron.cancelJob(`start_${discountId}`);
  
  // Schedule new cron job for updated start date
  scheduleStartDiscount(discountId, startDate);
};

// Function to reschedule cron job for updated end date
const rescheduleEndDiscount = (discountId, endDate) => {
  // Cancel existing cron job for end date
  cron.cancelJob(`end_${discountId}`);
  
  // Schedule new cron job for updated end date
  scheduleEndDiscount(discountId, endDate);
};

// Function to cancel scheduled cron jobs for a discount
const cancelScheduledJobs = (discountId) => {
  cron.cancelJob(`start_${discountId}`);
  cron.cancelJob(`end_${discountId}`);
};


exports.getAllDiscountsByRestaurant = async (req, res) => {
  try {
    const { restaurantId } = req.params; // Assuming restaurantId is part of the request parameters

    const discounts = await RestaurantDiscount.find({ restaurantId })
    .populate({
      path: 'selectedMenuItems',
      select: 'name',
    });


    res.status(200).json({ data: discounts });
  } catch (error) {
    console.error('Error getting discounts by restaurant:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
exports.getAllDiscounts = async (req, res) => {
  try {
    const allDiscounts = await RestaurantDiscount.find({})
      .populate({
        path: 'restaurantId',
        select: 'restaurantName', // Populate the restaurant name
      })
      .populate({
        path: 'selectedMenuItems',
        select: 'name', // Populate the name of the menu
      });

 

    // Check if there are any results
    if (allDiscounts.length === 0) {
      return res.status(404).json({ message: 'No discounts found' });
    }

    // If there are results, send them all
    res.status(200).json({ data: allDiscounts });
  } catch (error) {
    console.error('Error getting discounts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
  


