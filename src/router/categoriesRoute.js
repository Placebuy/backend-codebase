const express = require('express');

const router = express.Router();
const { requireAuth, verifyAdmin } = require('../middleware/authMiddleware');
const categoryController = require('../controllers/categoryController');

router.put('/:id',  categoryController.updateCategory);
router.post('/', categoryController.createCategory);
router.delete('/:id',verifyAdmin, categoryController.deleteCategory);
router.patch('/image/:id', categoryController.patchCategoryImage);
router.get('/', categoryController.getAvailableCategories);
router.get('/all', categoryController.getAllCategories);
router.get('/random', categoryController.getRandomCategories);
router.put('/availability/:id', categoryController.categoryAvailability);


module.exports = router;
 