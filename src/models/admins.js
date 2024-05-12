const mongoose = require('mongoose');
const crypto = require('crypto');
const Address = require('./address');
const userSchema = require('./users');

const adminSchema = userSchema.extend({
  userType: {
    type: String,
    required: true,
    default: 'Admin',
  },
});
adminSchema.methods.getResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(20).toString('hex');
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  this.resetPasswordExpire = new Date(Date.now() + 10 * 60 * 1000); // Set to 10 minutes from now
  return resetToken;
};

const Admin = mongoose.model('Admin', adminSchema);

module.exports = Admin;
