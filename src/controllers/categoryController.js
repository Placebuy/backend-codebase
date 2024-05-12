/* eslint-disable camelcase */
const httpStatus = require('http-status');
const Asyncly = require('../utils/Asyncly');
const ApiError = require('../utils/ApiError');
const Category = require('../models/categories');
// eslint-disable-next-line import/order
const cloudinary = require('cloudinary').v2;

const createCategory = Asyncly(async (req, res) => {
	//Upload image to Cloudinary
	//eslint-disable-next-line camelcase
	const { secure_url } = await cloudinary.uploader.upload(
		req.files.image.tempFilePath,
		{
			use_filename: true,
			folder: 'CategoryImage',
		},
	);
	//eslint-disable-next-line camelcase
	req.body.image = secure_url;
	const newCategory = new Category(req.body);

	// Save the new category to the database
	await newCategory.save();

	// Respond with success message
	res.status(httpStatus.CREATED).json({
		status: true,
		message: 'Category saved successfully',
	});
});

const updateCategory = Asyncly(async (req, res) => {
	const { id } = req.params;
	const { title, value } = req.body;
	const updatedCategory = await Category.findByIdAndUpdate(
		id,
		{ title, value },
		{ new: true },
	);

	if (!updatedCategory) {
		throw new ApiError(httpStatus.NOT_FOUND, 'Category not found');
	}

	res.status(httpStatus.OK).json({ status: true, message: 'Updated category' });
});

const deleteCategory = Asyncly(async (req, res) => {
	const { id } = req.params;
	const category = await Category.findById(id);

	if (!category) {
		throw new ApiError(httpStatus.NOT_FOUND, 'Category not found');
	}

	await Category.findByIdAndDelete(id);
	res
		.status(httpStatus.OK)
		.json({ status: true, message: 'Category deleted successfully' });
});

const getAvailableCategories= Asyncly(async (req, res) => {
	const categories = await Category.find({isAvailable:true});
	res.status(httpStatus.OK).json(categories);
});
const getAllCategories = Asyncly(async (req, res) => {
	const categories = await Category.find({});
	res.status(httpStatus.OK).json(categories);
});

const patchCategoryImage = Asyncly(async (req, res) => {
	const { id } = req.params;

	// Check if the category exists
	const existingCategory = await Category.findById(id);
	if (!existingCategory) {
		throw new ApiError(httpStatus.NOT_FOUND, 'Category not found');
	}

	// Upload the new image to Cloudinary
	const { secure_url } = await cloudinary.uploader.upload(
		req.files.image.tempFilePath,
		{
			use_filename: true,
			folder: 'CategoryImage',
		},
	);    

	// Update the category's image URL
	existingCategory.image = secure_url;

	// Save the updated category to the database
	await existingCategory.save();

	res
		.status(httpStatus.OK)
		.json({ status: true, message: 'Category image updated successfully' });
});

const getRandomCategories = Asyncly(async (req, res) => {
	const categories = await Category.aggregate([
		{ $match: { value: { $ne: 'more' } } },
		{ $sample: { size: 4 } },
	]);

	res.status(httpStatus.OK).json(categories);
});

const categoryAvailability = Asyncly(async (req, res) => {
	const categoryId = req.params.id;
	const category = await Category.findById(categoryId);
	if (!category) {
		throw new ApiError(httpStatus.NOT_FOUND, 'category item not found');
	}
	category.isAvailable = !category.isAvailable;
	await category.save();
	res
		.status(httpStatus.OK)
		.json({ status: true, message: 'category availability updated' });
});

module.exports = {
	createCategory,
	updateCategory,
	deleteCategory,
	getAllCategories,
	categoryAvailability,
	patchCategoryImage,
	getRandomCategories,
	getAvailableCategories
};
