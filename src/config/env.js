const { z } = require('zod');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../.env') });

// Define schema for environment variables using Zod
const envVarsSchema = z
	.object({
		NODE_ENV: z.string(),
		dbUrl: z.string().url(),
		JWT_SECRET: z.string(),
		//SUPERADMIN_PASS: z.string(),
		//ADMIN_EXPIRES_IN: z.string(),
		//DRIVER_EXPIRES_IN: z.string(),
		//SUPER_ADMIN_EXPIRES_IN: z.string(),
		//RESTAURANT_EXPIRES_IN: z.string(),
		API_KEY: z.string(),
		API_SECRET: z.string(),
		CLOUD_NAME: z.string(),
		PORT: z.string().default('8080'),
		EMAIL_USERNAME: z.string(),
		EMAIL_PASSWORD: z.string(),
		EMAIL_FROM: z.string(),
		EMAIL_SERVICE: z.string(),
		//PAYSTACK_KEY: z.string(),
	})
// Validate NODE_ENV separately for allowed values
if (
	process.env.NODE_ENV &&
	!['production', 'development', 'test'].includes(process.env.NODE_ENV)
) {
	throw new Error(
		"Invalid NODE_ENV value. Allowed values are 'production', 'development', or 'test'.",
	);
}

// Parse and validate environment variables
const parsedEnvVars = envVarsSchema.safeParse(process.env);

// Check if validation was successful
if (!parsedEnvVars.success) {
  // Generate error message from validation errors
  const validationErrors = parsedEnvVars.error.errors.map((error) => error.message).join('\n');
	throw new Error(`Config validation error:\n${validationErrors}`);
}

// Export variables or use them as needed
module.exports = {
	env: process.env.NODE_ENV,
	PORT: parsedEnvVars.data.PORT,
	dbUrl: parsedEnvVars.data.dbUrl,
	jwt: {
		secret: parsedEnvVars.data.JWT_SECRET,
	},
	superadminPass: parsedEnvVars.data.SUPERADMIN_PASS,
	adminExpiresIn: parsedEnvVars.data.ADMIN_EXPIRES_IN,
	driverExpiresIn: parsedEnvVars.data.DRIVER_EXPIRES_IN,
	superAdminExpiresIn: parsedEnvVars.data.SUPER_ADMIN_EXPIRES_IN,
	restaurantExpiresIn: parsedEnvVars.data.RESTAURANT_EXPIRES_IN,
	apiKey: parsedEnvVars.data.API_KEY,
	apiSecret: parsedEnvVars.data.API_SECRET,
	cloudName: parsedEnvVars.data.CLOUD_NAME,
	email: {
		username: parsedEnvVars.data.EMAIL_USERNAME,
		password: parsedEnvVars.data.EMAIL_PASSWORD,
		from: parsedEnvVars.data.EMAIL_FROM,
		service: parsedEnvVars.data.EMAIL_SERVICE,
	},
	paystackKey: parsedEnvVars.data.PAYSTACK_KEY,
};
