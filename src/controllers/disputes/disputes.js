const Dispute = require('../../models/disputes');
const Restaurant = require('../models/restaurant');
const logger = require('../../config/logger');
const httpStatus = require('http-status');

// Function to list all nature of complaints
exports.listNatureOfComplaints = async (req, res) => {
  try {
    res.status(200).json({ success: true, data: Dispute.schema.path('natureOfComplaint').enumValues });
  } catch (error) {
    console.error('Error listing nature of complaints:', error.message);
    res.status(500).json({ success: false, error: 'Error listing nature of complaints' });
  }
};

// Function to get a dispute by ID
exports.getDisputeById = async (req, res) => {
  try {
    const { id } = req.params;
    const dispute = await Dispute.findById(id);
    if (!dispute) {
      return res.status(404).json({ success: false, error: 'Dispute not found' });
    }
    res.status(200).json({ success: true, data: dispute });
  } catch (error) {
    console.error('Error fetching dispute by ID:', error.message);
    res.status(500).json({ success: false, error: 'Error fetching dispute by ID' });
  }
};

// Function to delete a dispute by ID
exports.deleteDisputeById = async (req, res) => {
  try {
    const { id } = req.params;
    const dispute = await Dispute.findByIdAndDelete(id);
    if (!dispute) {
      return res.status(404).json({ success: false, error: 'Dispute not found' });
    }
    res.status(200).json({ success: true, data: dispute });
  } catch (error) {
    console.error('Error deleting dispute by ID:', error.message);
    res.status(500).json({ success: false, error: 'Error deleting dispute by ID' });
  }
};

// Controller function to handle sending a dispute
exports.sendDispute = async (req, res) => {
  try {
   const restaurantId = req.user.id
      // Extract necessary data from request body
      const { natureOfComplaint, description,email,phoneNumber,name ,restaurantName} = req.body;

      // Obtain restaurant ID from middleware authentication
  
     

      // Create a new dispute using extracted data
      const dispute = await Dispute.create({
          natureOfComplaint,
          restaurantName,
          name,
          description,
          email,
          phoneNumber, // Include restaurant email from middleware authentication
          restaurant: restaurantId, // Assign restaurant ID obtained from middleware
      });

      res.status(httpStatus.CREATED).json({ success: true, data: dispute });
  } catch (error) {
      console.error('Error sending dispute:', error.message);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, error: 'Error sending dispute' });
  }
};







// Controller function to get all disputes by restaurant
exports.getDisputesByRestaurant = async (req, res) => {
  try {
    const { restaurantId } = req.params; // Assuming restaurantId is passed as a parameter
    const disputes = await Dispute.find({ restaurant: restaurantId });
    res.status(200).json({ success: true, data: disputes });
  } catch (error) {
    console.error('Error fetching disputes by restaurant:', error.message);
    res.status(500).json({ success: false, error: 'Error fetching disputes' });
  }
};
