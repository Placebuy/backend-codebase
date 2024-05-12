const { z } = require('zod');

const companySchema = z.object({
	Companyname: z
		.string()
		.min(2, 'Last name must be at least 2 characters long'),

	email: z.string().email('Invalid email format'),
	password: z
		.string()
		.min(8, 'Password must be at least 8 characters long'),
		// Consider additional password strength requirements
		// .regex(
		// 	/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}/,
		// 	'Password must contain at least one uppercase, lowercase, number, and symbol',
		// ),
	phoneNumber: z
		.string()
		.min(11, 'Phone number must be at least 11 digits')
		.regex(/^[0-9]+$/, 'Phone number can only contain digits'),
	image: z.string().optional(), // Optional image field
	userType: z.string().default('Company'), // Specify default userType
	address: z.object({
		street: z.string().min(3, 'Street must be at least 3 characters long'),
		city: z.string().min(3, 'City must be at least 3 characters long'),
		state: z.string().min(2, 'State must be at least 2 characters long'),
		zipCode: z.string().min(5, 'Zip code must be at least 5 characters long'),
	}),
});

module.exports = {
	companySchema,
};
