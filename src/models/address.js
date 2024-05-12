const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema(
  {
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Buyer',
      required: true,
    },
    lodge: { type: String },
    city: { type: String },
    state: { type: String },
    zipCode: { type: String },
  },
  { timestamps: true },
);

const Address = mongoose.model('Address', addressSchema);

module.exports = Address;
