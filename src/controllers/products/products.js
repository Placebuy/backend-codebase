/* eslint-disable camelcase */
/* eslint-disable import/order */
const httpStatus = require('http-status');
const Asyncly = require('../../utils/Asyncly');
const ApiError = require('../../utils/ApiError');
//const Food = require('../models/food');
//const Restaurant = require('../models/restaurant');
//const logger = require('../../config/logger');
const cloudinary = require('cloudinary').v2;
const productValidation = require('../../validation/productValidation');
const Product = require('../../models/products');
const { paginate } = require('../../utils/pagination');
const Review = require('../../models/reviews');

// const Category = require('../../models/categories');
// const Menu = require('../models/restaurantMenu');
// const Additive = require('../models/additive');

const uploadProduct = Asyncly(async (req, res) => {
  const productData = productValidation.uploadProductSchema.parse(req.body);
  const userType = req.user.userType;
  const { userId } = req;

  if (userType === 'Buyer' && productData.type === 'new') {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      'Buyers cannot add brand new products. Only used products are allowed',
    );
  }

  let uploadedImage;
  if (req.files && req.files.image) {
    const { secure_url } = await cloudinary.uploader.upload(
      req.files.image.tempFilePath,
      {
        use_filename: true,
        folder: 'Products/images',
      },
    );
    uploadedImage = secure_url;
  }
  const newProduct = new Product({
    ...productData,
    vendor: userId,
    image: uploadedImage,
    price: Number(productData.price),
    availableUnits: Number(productData.availableUnits),
  });

  await newProduct.save();

  return res
    .status(httpStatus.CREATED)
    .json({ data: newProduct, message: 'Product uploaded successfully' });
});

const listAllProducts = Asyncly(async (req, res) => {
  const { metadata, results } = await paginate(Product, req);
  return res.status(httpStatus.OK).json({ metadata, results });
});

const getProductById = Asyncly(async (req, res) => {
  const { productId } = req.params;
  const product = await Product.findById(productId).exec();
  if (!product) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Product not found');
  }
  // const reviews = await Review.find({ productId: productId }).exec();
  const { metadata, results } = await paginate(Review, req, {}, { productId });
  const reviews = {
    result: [{ metadata }, ...results],
  };
  return res.status(httpStatus.OK).json({ product, reviews });
});

const updateProductById = Asyncly(async (req, res) => {
  const { productId } = req.params;
  const productData = productValidation.updateProductSchema.parse(req.body);

  let uploadedImage;
  if (req.files && req.files.image) {
    const { secure_url } = await cloudinary.uploader.upload(
      req.files.image.tempFilePath,
      {
        use_filename: true,
        folder: 'Products/images',
      },
    );
    uploadedImage = secure_url;
  }

  if (productData.price) {
    productData.price = Number(productData.price);
  }
  if (productData.availableUnits) {
    productData.availableUnits = Number(productData.availableUnits);
  }

  const product = await Product.findByIdAndUpdate(
    productId,
    {
      ...productData,
      image: uploadedImage,
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!product) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Product not found');
  }
  return res
    .status(httpStatus.OK)
    .json({ data: product, message: 'Product updated successfully' });
});

const deleteProductById = Asyncly(async (req, res) => {
  const { productId } = req.params;
  const { userId } = req;
  const product = await Product.findByIdAndDelete(productId);

  if (!product) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Product not found');
  }
  if (product.vendor === userId) {
    throw new ApiError(httpStatus.FORBIDDEN, `You can't perform this action!`);
  }
  return res
    .status(httpStatus.OK)
    .json({ message: 'Product deleted successfully' });
});

const listUserProducts = Asyncly(async (req, res) => {
  //const { userId } = req;
  const { userId } = req.params;
  const query = { vendor: userId };
  const { metadata, results } = await paginate(Product, req, query);
  if (results.length === 0) {
    throw new ApiError(httpStatus.NOT_FOUND, 'No products found');
  }
  return res.status(httpStatus.OK).json({ metadata, results });
});

module.exports = {
  uploadProduct,
  listAllProducts,
  getProductById,
  updateProductById,
  deleteProductById,
  listUserProducts,
};
