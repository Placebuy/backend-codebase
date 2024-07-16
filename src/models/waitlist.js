const mongoose = require('mongoose');
const { default: validator } = require('validator');

const WaitlistSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      //required: true,
      trim: true,
      minLength: [3, 'Minimum length must be 3'],
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator(value) {
          if (!validator.isEmail(value)) {
            throw new Error('Email is invalid');
          }
        },
      },
    },
    institution: String,
  },
  { timestamps: true },
);

module.exports = mongoose.model('Waitlist', WaitlistSchema);
