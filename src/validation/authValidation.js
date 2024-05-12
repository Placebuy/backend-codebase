const { z } = require('zod');
const mongoose = require('mongoose');
//const addressSchema = require('./addressValidation');

const signupSchema = z.object({
  firstName: z
    .string()
    .min(3, 'Must be at least 3 characters long')
    .regex(/^[a-zA-Z]+$/, 'Cannot contain numbers')
    .trim(),
  lastName: z
    .string()
    .min(3, 'Must be at least 3 characters long')
    .regex(/^[a-zA-Z]+$/, 'Cannot contain numbers')
    .trim(),
  email: z.string().email('Invalid email format').toLowerCase().trim(),
  password: z
    .string()
    .min(8, 'Must be at least 8 characters long')
    .regex(
      /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}/,
      'Must contain at least one uppercase, lowercase, number, and symbol',
    )
    .trim(),
  phoneNumber: z.string().min(11, 'Must be at least 11 digits').trim(),
  brandName: z.string().optional(),
  brandImage: z.string().optional(),
  campus: z.string().min(3, 'Must be at least 3 characters long').trim(),
});

const loginSchema = z.object({
  email: z
    .string()
    .email('Invalid email format')
    .refine((value) => !!value, {
      message: 'Email is required',
    }),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .refine((value) => !!value, {
      message: 'Password is required',
    }),
  rememberMe: z.boolean().optional(),
});

//const buyerSchema = baseSchema;

//const adminSchema = baseSchema;

/**const vendorSchema = baseSchema.extend({
  brandName: z.string().min(3, 'Must be at least 3 characters long'),
  brandImage: z.string().optional(),
});*/




// Will visit later after working on the authentification
const driverSchema = z.object({
  firstname: z
    .string()
    .min(3, 'First name must be at least 3 characters long')
    .regex(/^[a-zA-Z]+$/, 'First name cannot contain numbers'),
  lastname: z
    .string()
    .min(3, 'Last name must be at least 3 characters long')
    .regex(/^[a-zA-Z]+$/, 'Last name cannot contain numbers'),
  email: z.string().email('Invalid email format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(
      /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}/,
      'Password must contain at least one uppercase, lowercase, number, and symbol',
    ),
  phoneNumber: z
    .string()
    .min(11, 'Phone number must be at least 11 digits')
    .regex(/^[0-9]+$/, 'Phone number can only contain digits'),
  NIN: z
    .string()
    .min(11, 'NIN must be at least 11 digits')
    .regex(/^[0-9]+$/, 'NIN can only contain digits'),
  image: z.string().optional(),
  vehicleType: z.enum(['motorcycle', 'bicycle', 'foot']),
  vehiclePlateNumber: z
    .string()
    .regex(/^[A-Z]{3}-\d{3}-[A-Z]{2}$/, 'Invalid vehicle plate number format')
    .optional(),
});

const restaurantSchema = z.object({
  firstname: z
    .string()
    .min(3, 'First name must be at least 3 characters long')
    .regex(/^[a-zA-Z]+$/, 'First name cannot contain numbers'),
  lastname: z
    .string()
    .min(3, 'Last name must be at least 3 characters long')
    .regex(/^[a-zA-Z]+$/, 'Last name cannot contain numbers'),
  email: z.string().email('Invalid email format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(
      /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}/,
      'Password must contain at least one uppercase, lowercase, number, and symbol',
    ),
  image: z.string().optional(),
  phoneNumber: z
    .string()
    .min(11, 'Phone number must be at least 11 digits')
    .regex(/^[0-9]+$/, 'Phone number can only contain digits'),
  restaurantName: z.string()
});

const forgotPasswordSchema = z.object({
  email: z
    .string()
    .email('Invalid email format')
    .refine((value) => !!value, {
      message: 'Email is required',
    }),
});

const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      'Must contain a lowercase, uppercase, digit, and special character',
    ),
  otp: z.string().min(4, 'OTP must be at least 4 characters long')
});

const passwordChangeSchema = z.object({
  currentPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    // .regex(
    // 	/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+=[\]{};':\\|,.<>/?~-])[A-Za-z\d!@#$%^&*()_+=[\]{};':\\|,.<>/?~-]{8,}$/,
    // 	'Must contain a lowercase, uppercase, digit, and special character',
    // )
    .refine((val) => typeof val === 'string', {
      message: 'Current password is required',
    }),

  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    // .regex(
    // 	/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+=[\]{};':\\|,.<>/?~-])[A-Za-z\d!@#$%^&*()_+=[\]{};':\\|,.<>/?~-]{8,}$/,
    // 	'Must contain a lowercase, uppercase, digit, and special character',
    // )
    .refine((val) => typeof val === 'string', {
      message: 'New password is required',
    }),
});
const passwordChangeWithoutCurrentSchema = z.object({
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+=[\]{};':\\|,.<>/?~-])[A-Za-z\d!@#$%^&*()_+=[\]{};':\\|,.<>/?~-]{8,}$/,
      'Must contain a lowercase, uppercase, digit, and special character',
    )
    .refine((val) => typeof val === 'string', {
      message: 'New password is required',
    }),
});

module.exports = {
  // buyerSchema,
  // vendorSchema,
  // driverSchema,
  signupSchema,
  restaurantSchema,
  // adminSchema,
  loginSchema,
  resetPasswordSchema,
  forgotPasswordSchema,
  passwordChangeSchema,
  passwordChangeWithoutCurrentSchema,
};
