const { trim } = require('validator');
const { z } = require('zod');

const waitlistSchema = z.object({
  fullName: z.string().min(3, 'Minimum length must be 3').trim(),

  email: z.string().email('Email is invalid'),

  institution: z.string().trim(),
});

module.exports = {
  waitlistSchema,
};
