const express = require('express');

const router = express.Router();
const { requireAuth, verifyAdmin } = require('../middleware/authMiddleware');
const cartController = require('../controllers/cartController');


router.post('/',requireAuth, cartController.addProductToCart); 
router.patch('/:id',requireAuth, cartController.editCartItemAdditives); 
router.post('/decrement', requireAuth,cartController.decrementProductQty);
router.post('/increment',requireAuth, cartController.incrementProductQty);
router.delete('/delete/:itemId',requireAuth, cartController.removeProductFromCart); // <-- Updated this line
router.get('/', requireAuth,cartController.fetchUserCart);
router.get('/count',requireAuth, cartController.getCartCount);
router.delete('/clear', requireAuth,cartController.clearUserCart);

module.exports = router;
