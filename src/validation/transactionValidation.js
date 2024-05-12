const { z, ZodError } = require('zod');

const transactionSchema = z.object({
	amount: z.number(),
	currency: z
		.string()
		.min(3)
		.max(3)
		.regex(/^[A-Z]+$/)
		.optional(),
	paymentMethod: z.string().min(1),
	customerId: z.string().uuid('Invalid customer ID'),
	order: z.object({
		orderId: z.string().uuid('Invalid order ID'),
		items: z.array(
			z.object({
				itemId: z.string().uuid('Invalid item ID'),
				quantity: z.number().positive('Quantity must be a positive number'),
			}),
		),
	}),
	transactionReference: z.string(),
	timestamp: z.date(), 
});

const TransactionInput = transactionSchema._input;

module.exports = { transactionSchema, TransactionInput }; 
