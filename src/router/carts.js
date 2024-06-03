const express = require('express');

const router = express.Router();
const { requireAuth, verifyAdmin } = require('../middleware/authMiddleware');
const {
  addProductToCart,
  getUserCart,
  updateUsercart,
  removeProductFromCart,
  clearUserCart,
  decrementProductQty,
} = require('../controllers/carts/carts');

router.post('/', requireAuth, addProductToCart);
router.get('/', requireAuth, getUserCart);
router.put('/', requireAuth, updateUsercart);
router.delete('/', requireAuth, clearUserCart);
router.delete('/:productId', requireAuth, removeProductFromCart);
router.post('/decrement/:productId', requireAuth, decrementProductQty);

module.exports = router;
