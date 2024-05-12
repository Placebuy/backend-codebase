const { z } = require('zod');

const editAdminSchema = z.object({
	firstname: z
		.string()
		.min(3, 'First name must be at least 3 characters long')
		.regex(/^[a-zA-Z]+$/, 'First name cannot contain numbers')
		.optional(),
	lastname: z
		.string()
		.min(3, 'Last name must be at least 3 characters long')
		.regex(/^[a-zA-Z]+$/, 'Last name cannot contain numbers')
		.optional(),
	email: z.string().email('Invalid email format').optional(),
	phoneNumber: z
		.string()
		.min(11, 'Phone number must be at least 11 digits')
		.regex(/^[0-9]+$/, 'Phone number can only contain digits')
		.optional(),
	address: z
		.string()
		.trim() // Remove leading/trailing whitespace
		.min(3, 'Address must be at least 3 characters long')
		.max(100, 'Address must be at most 100 characters long')
		.optional(),
});

module.exports = { editAdminSchema };
