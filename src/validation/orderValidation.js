const { isMobilePhone } = require('validator');
const { z } = require('zod');

const placeOrderSchema = z.object({
  fullname: z.string().optional(),
  address: z.string().trim(),
  phonenumber: z
    .string()
    .trim()
    .refine((value) => isMobilePhone(value, 'en-NG'), {
      message: 'Invalid phone number',
    }),
  university: z.string(),
  paymentOption: z.enum(['onDelivery', 'beforeDelivery']),
  paymentMethod: z.enum(['Card', 'Transfer', 'Cash']),

  // orderTotal: z.number(),
  // deliveryFee: z.number(),
  // discount: z.number().optional(),
  // serviceFee: z.number().min(0),
  // grandTotal: z.number().optional(),
  // paymentMethod: z.string(),
  // restaurantId: z.string(),
  // orderItems: z.array(orderItemSchema),
  // fcm_device_token: z.string().optional(),
});

module.exports = { placeOrderSchema };
