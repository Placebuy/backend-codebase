const express = require('express');
const validate = require('../utils/validate');
const productValidation = require('../validation/productValidation');
//const registerVendor  = require('../controllers/vendor/auth');
//const registerBuyer = require('../controllers/buyers/auth');
//const registerAdmin = require('../controllers/admin/auth');
const { requireAuth } = require('../middleware/authMiddleware');

const {
  uploadProduct,
  listAllProducts,
  getProductById,
  updateProductById,
  deleteProductById,
  listUserProducts,
} = require('../controllers/products/products');

const router = express.Router();

router.post(
  '/',
  validate(productValidation.uploadProductSchema),
  requireAuth,
  uploadProduct,
);
router.get('/', listAllProducts);

router.put('/:productId', requireAuth, updateProductById);

router.get('/:productId', getProductById);

router.delete('/:productId', requireAuth, deleteProductById);

router.get('/users/:userId', requireAuth, listUserProducts);

module.exports = router;
