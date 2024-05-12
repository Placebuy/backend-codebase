const { z } = require('zod');

const addressSchema = z.object({
	street: z.string().nonempty('Street is required'),
	city: z.string().nonempty('City is required'),
	state: z.string().nonempty('State is required'),
	zipCode: z.string().nonempty('Zip Code is required'),
});

module.exports = addressSchema;
