const RecentSearch = require('../models/recentSearch');
const mongoose= require('mongoose')

exports.addRecentSearch = async (req, res) => {
    try {
        const { foodId } = req.body;

        console.log('Received foodId:', foodId);

        // Check if foodId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(foodId)) {
            console.error('Invalid foodId:', foodId);
            return res.status(400).json({ success: false, error: 'Invalid foodId' });
        }

        // Create a new RecentSearch instance
        const recentSearch = new RecentSearch({
            userId: req.user.id,
            foodId
        });

        // Save the new document to the database
        await recentSearch.save();

        console.log('Recent search saved successfully');

        res.status(201).json({ success: true, data: recentSearch });
    } catch (error) {
        console.error('Error adding recent search:', error);
        res.status(500).json({ success: false, error: 'Error adding recent search' });
    }
};



// Controller to get last 5 recent searches and populate food names
exports.getLast5RecentSearches = async (req, res) => {
    try {
        const recentSearches = await RecentSearch.find({ userId: req.user.id })
            .sort({ createdAt: -1 }) 
            .limit(5)
            .populate({
                path: 'foodId',
                select: 'title', // Select only the 'name' field of the populated food document
            });

        res.status(200).json({ success: true, data: recentSearches });
    } catch (error) {
        console.error('Error getting last 5 recent searches:', error);
        res.status(500).json({ success: false, error: 'Error getting last 5 recent searches' });
    }
};

// Controller to delete recent search by ID
exports.deleteRecentSearchById = async (req, res) => {
    try {
        const { id } = req.params;

        const deletedSearch = await RecentSearch.findByIdAndDelete(id);

        if (!deletedSearch) {
            return res.status(404).json({ success: false, error: 'Recent search not found' });
        }

        res.status(200).json({ success: true, data: deletedSearch });
    } catch (error) {
        console.error('Error deleting recent search:', error);
        res.status(500).json({ success: false, error: 'Error deleting recent search' });
    }
};