const mongoose = require('mongoose');

const natureOfComplaintEnum = [
  'Missing Items',
  'Billing Issue',
  'Delivery Person Behavior',
  'Packaging Issue',
  'Payment Problem',
  'Order Cancellation Issue',
  'Accessibility Issue',
  'Order Tracking Problem',
  'Technical Glitches',
  'Product Quality Issue',
  'Seller Issue',
  'Other',
];

const disputeSchema = new mongoose.Schema({
  name: {
    type: String,
  },
  buyerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Buyer',
  },
  phoneNumber: {
    type: String,
    // required: true
  },
  orderId: {
    type: String,
    // required: true
  },
  vendorName: {
    type: String,
    // required: true
  },
  email: {
    type: String,
    // required: true
  },
  natureOfComplaint: {
    type: String,
    enum: natureOfComplaintEnum,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
});

const Dispute = mongoose.model('Dispute', disputeSchema);

module.exports = Dispute;
