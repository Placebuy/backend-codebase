const { z } = require('zod');

const cartItemSchema = z.object({
  productId: z.string().min(2, 'Invalid product id').trim(),
  quantity: z.number().default(1),
});

const updateCartSchema = z.object({
  productId: z.string().min(2, 'Invalid product id').trim(),
  quantity: z.number().min(1, 'Invalid quantity').optional(),
});


module.exports = {
  updateCartSchema,
  cartItemSchema,
}