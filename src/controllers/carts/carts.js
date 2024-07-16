const httpStatus = require('http-status');
const Cart = require('../../models/carts');
const Asyncly = require('../../utils/Asyncly');
const ApiError = require('../../utils/ApiError');
const logger = require('../../config/logger');
const Product = require('../../models/products');
const cartValidation = require('../../validation/cartValidation');

/**
 * Adds a product to the user's cart or updates the quantity if the product already exists.
 * @param {Object} req - The Express request object.
 * @param {Object} res - The Express response object.
 * @returns {Object} - The updated cart.
 */

const addProductToCart = Asyncly(async (req, res) => {
  const cartItem = cartValidation.cartItemSchema.parse(req.body);
  const userId = req.user.id;
  const { productId } = cartItem;
  const quantity = cartItem.quantity || 1;

  // Fetch the product from the database
  const product = await Product.findById(productId);
  if (!product) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Product not found');
  }
  if (product.availableUnits < quantity) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Quantity exceeds available units',
    );
  }
  const price = Number(product.price);
  let cart = await Cart.findOne({ buyerId: userId });
  if (!cart) {
    cart = new Cart({
      buyerId: userId,
      items: [],
      totalItems: 0,
      totalPrice: 0,
    });
  }

  // Check if the product is already in the cart
  const itemIndex = cart.items.findIndex((item) =>
    item.productId.equals(productId),
  );
  // if the product is already in the cart, update the quantity and price
  if (itemIndex > -1) {
    cart.items[itemIndex].quantity += quantity;
    cart.items[itemIndex].price += price;
  } else {
    // if the product is not in the cart, add it
    cart.items.push({ productId, quantity, price: price * quantity });
  }
  // Update the total items and price in the cart
  cart.totalItems = cart.items.length;
  cart.totalPrice = cart.items.reduce((acc, item) => acc + item.price, 0);

  await cart.save();
  return res.status(httpStatus.CREATED).json(cart);
});

/**
 * Retrieves the user's cart.
 * @param {Object} req - The Express request object.
 * @param {Object} res - The Express response object.
 * @returns {Object} - The user's cart.
 */

const getUserCart = Asyncly(async (req, res) => {
  const userId = req.user.id;
  const cart = await Cart.findOne({ buyerId: userId });
  if (!cart) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      'Your cart is empty. Add products to cart to view them here.',
    );
  }
  return res.status(httpStatus.OK).json(cart);
});

/**
 * Updates the quantity of a product in the user's cart.
 * @param {Object} req - The Express request object.
 * @param {Object} res - The Express response object.
 * @returns {Object} - The updated cart.
 */

const updateUsercart = Asyncly(async (req, res) => {
  const cartItem = cartValidation.updateCartSchema.parse(req.body);
  const userId = req.user.id;
  const cart = await Cart.findOne({ buyerId: userId });

  if (!cart) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      'Your cart is empty. Add products to cart to view them here.',
    );
  }
  const { productId, quantity } = cartItem;
  const product = await Product.findById(productId);

  if (!product) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Product not found');
  }

  if (product.availableUnits < quantity) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Quantity exceeds available units',
    );
  }
  // find the item in the cart
  const itemIndex = cart.items.findIndex((item) =>
    item.productId.equals(productId),
  );

  if (itemIndex > -1) {
    cart.items[itemIndex].quantity = quantity;
    cart.items[itemIndex].price = product.price * quantity;
  } else {
    cart.items.push({ productId, quantity, price: product.price * quantity });
  }

  cart.totalPrice = cart.items.reduce((acc, item) => acc + item.price, 0);

  await cart.save();
  return res
    .status(httpStatus.OK)
    .json({ cart, message: 'cart updated successfully!' });
});

/**
 * Removes a product from the user's cart.
 * @param {Object} req - The Express request object.
 * @param {Object} res - The Express response object.
 * @returns {Object} - The updated cart.
 */

const removeProductFromCart = Asyncly(async (req, res) => {
  const { productId } = req.params;
  const userId = req.user.id;
  const cart = await Cart.findOne({ buyerId: userId });

  if (!cart) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      'Your cart is empty. Add products to cart to view them here.',
    );
  }
  const itemIndex = cart.items.findIndex((item) =>
    item.productId.equals(productId),
  );
  if (itemIndex > -1) {
    cart.items.splice(itemIndex, 1);
    cart.totalItems = cart.items.length;
    cart.totalPrice = cart.items.reduce((acc, item) => acc + item.price, 0);

    await cart.save();

    return res
      .status(httpStatus.OK)
      .json({ message: 'Product removed from cart' });
  }
  throw new ApiError(httpStatus.NOT_FOUND, 'Product not found in cart');
});

/**
 * Clears the user's cart.
 * @param {Object} req - The Express request object.
 * @param {Object} res - The Express response object.
 * @returns {Object} - Success message.
 */

const clearUserCart = Asyncly(async (req, res) => {
  const userId = req.user.id;
  await Cart.deleteMany({ buyerId: userId });
  return res
    .status(httpStatus.OK)
    .json({ message: 'Cart cleared successfully' });
});

/**
 * Decrements the quantity of a product in the user's cart.
 * @param {Object} req - The Express request object.
 * @param {Object} res - The Express response object.
 * @returns {Object} - The updated cart.
 */

const decrementProductQty = Asyncly(async (req, res) => {
  const { productId } = req.params;
  const userId = req.user.id;
  const cart = await Cart.findOne({ buyerId: userId });

  if (!cart) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      'Your cart is empty. Add products to cart to view them here.',
    );
  }
  const itemIndex = cart.items.findIndex((item) =>
    item.productId.equals(productId),
  );
  if (itemIndex > -1) {
    if (cart.items[itemIndex].quantity > 1) {
      cart.items[itemIndex].quantity -= 1;
      cart.items[itemIndex].price =
        cart.items[itemIndex].price -
        cart.items[itemIndex].price / (cart.items[itemIndex].quantity + 1);
      cart.totalPrice = cart.items.reduce((acc, item) => acc + item.price, 0);
      await cart.save();
      return res
        .status(httpStatus.OK)
        .json({ cart, message: 'Product quantity decremented' });
    }
    throw new ApiError(httpStatus.BAD_REQUEST, 'Minimum quantity reached');
  }
  throw new ApiError(httpStatus.NOT_FOUND, 'Product not found in cart');
});

// Revisit this code
const mergeCarts = async (req, res) => {
  try {
    const guestCartItems = req.body.cartItems; // Assuming guest cart items are sent in the request body
    const userId = req.user.id; // Assuming user is authenticated and user id is available in the request

    // Retrieve user's cart
    const userCart = await Cart.findOne({ buyerId: userId });

    // If user has a cart, merge guest cart items
    if (userCart) {
      guestCartItems.forEach(async (guestCartItem) => {
        const { productId, quantity } = guestCartItem;

        // Check if product already exists in user's cart
        const existingItemIndex = userCart.items.findIndex((item) =>
          item.productId.equals(productId),
        );

        if (existingItemIndex > -1) {
          // If product already exists, update quantity
          userCart.items[existingItemIndex].quantity += quantity;
        } else {
          // If product doesn't exist, add it to user's cart
          userCart.items.push({ productId, quantity });
        }
      });

      // Recalculate total items and total price
      userCart.totalItems = userCart.items.length;
      userCart.totalPrice = userCart.items.reduce(
        (acc, item) => acc + item.quantity * item.price,
        0,
      );

      // Save the updated user cart
      await userCart.save();

      return res
        .status(httpStatus.OK)
        .json({ message: 'Guest cart merged successfully' });
    } else {
      // If user does not have a cart, create one and add guest cart items
      const newCart = new Cart({
        buyerId: userId,
        items: guestCartItems,
        totalItems: guestCartItems.length,
        totalPrice: guestCartItems.reduce(
          (acc, item) => acc + item.quantity * item.price,
          0,
        ),
      });

      // Save the new cart
      await newCart.save();

      return res
        .status(httpStatus.CREATED)
        .json({ message: 'Guest cart merged successfully' });
    }
  } catch (error) {
    // Handle any errors
    console.error(error);
    return res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .json({ error: 'Internal server error' });
  }
};

module.exports = {
  addProductToCart,
  getUserCart,
  updateUsercart,
  removeProductFromCart,
  clearUserCart,
  decrementProductQty,
};
