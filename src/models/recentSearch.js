const mongoose = require('mongoose');

const recentSearchSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    foodId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Food',
      required: true,
    },
  },
  { timestamps: true },
);

const RecentSearch = mongoose.model('RecentSearch', recentSearchSchema);

module.exports = RecentSearch;
