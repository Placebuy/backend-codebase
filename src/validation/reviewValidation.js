const { z } = require('zod');

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(1).max(500),
});

module.exports = reviewSchema;