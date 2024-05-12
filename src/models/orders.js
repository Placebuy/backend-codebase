const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;
mongoose.T;

const orderItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },

  quantity: {
    type: Number,
    default: 0,
    // required: true,
  },
  price: {
    type: Number,
    required: true,
  },
});

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    // required: true,
    unique: true,
  },
  buyerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Buyer',
    required: true,
  },
  orderItems: [orderItemSchema],
  orderTotal: {
    type: Number,
    required: true,
  },
  deliveryFee: {
    type: Number,
    required: true,
    default: 0,
  },
  serviceFee: {
    type: Number,
    required: true,
    default: 0,
  },
  grandTotal: {
    type: Number,
    required: true,
    default: 0,
  },
  discount: {
    type: Number,
    default: 0,
  },
  deliveryAddress: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Address',
    // required: true,
  },
  orderStatus: {
    type: String,
    enum: [
      'PENDING',
      'CONFIRMED',
      'PICK UP SOON',
      'ON THE WAY',
      'DELIVERED',
      'RETURNED',
    ],
    default: 'PENDING',
  },
  orderDate: {
    type: Date,
    default: Date.now,
  },
});

orderSchema.pre('save', async function (next) {
  try {
    if (!this.orderId) {
      const objectId = new ObjectId();
      const randomComponent = Math.floor(Math.random() * 1000);
      const orderId = `PB${objectId
        .toHexString()
        .substring(0, 8)}${randomComponent.toString().padStart(3, '0')}`;
      this.orderId = orderId
      //console.log('Generated orderId:', this.orderId);
    }
    this.markModified('orderId');
    next();
  } catch (error) {
    console.error('Error in pre-save middleware:', error);
    next(error);
  }
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;

/**
 * paymentMethod: {
		type: String,
		enum: ['Card', 'Transfer'],
		required: true,
	},
	paymentStatus: {
		type: String,
		enum: ['Pending', 'Completed', 'Failed'],
		default: 'Pending',
		// required: true,
	},
 */
