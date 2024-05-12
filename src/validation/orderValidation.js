const { z } = require('zod');


const orderItemSchema = z.object({
  foodId: z.string(),
  quantity: z.number().optional(),
  price: z.number(),
  additives: z.array(z.string()),
  instructions: z.string().optional(),
});

const placeOrderSchema = z.object({
	orderTotal: z.number(),
	deliveryFee: z.number(),
	discount: z.number().optional(),
	serviceFee: z.number().min(0),
  grandTotal: z.number().optional(),
  paymentMethod: z.string(),
  restaurantId: z.string(),
  orderItems: z.array(orderItemSchema),
  fcm_device_token: z.string().optional(),  
});


module.exports = { placeOrderSchema }   