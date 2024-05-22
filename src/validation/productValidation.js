const { z } = require('zod');

const uploadProductSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(),
  category: z.string(),
  price: z.string().min(1),
  availableUnits: z.string().min(1),
  image: z.any(),
  type: z.enum(['new', 'used']),
});

const updateProductSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().min(1).max().optional(),
  category: z.string().optional(),
  price: z.string().optional(),
  image: z.any().optional(),
  type: z.enum(['new', 'used']).optional(),
  availableUnits: z.string().min(1).optional(),
});

module.exports = { uploadProductSchema, updateProductSchema };

// title: {
//   type: String,
//   required: true,
// },
// description: {
//   type: String,
//   required: true,
// },
// category: {
//   type: String,
//   required: true,
// },
// price: {
//   type: Number,
// },
// availableUnits: {
//   type: Number,
//   default: 0,
// },
// image: {
//   type: String,
// },
// isAvailable: {
//   type: Boolean,
//   default: true,
// },
// type: {
//   type: String,
//   enum: ['new', 'used'],
