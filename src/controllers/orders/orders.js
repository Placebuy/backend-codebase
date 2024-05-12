const httpStatus = require('http-status');
const Asyncly = require('../../utils/Asyncly');
const ApiError = require('../../utils/ApiError');
const Order = require('../models/order');
const { DynamicAddress } = require('../models/location');
const User = require('../models/userRoleModel');
const sendPushNotification = require('../../helpers/pushNotification');
const logger = require('../../config/logger');
const Cart = require('../models/cart');
const initiatePaystackTransaction = require('../../helpers/initiatepaystack');
const { orderValidation } = require('../../validation');
const Transaction = require('../models/transaction');
const { v4: uuidv4 } = require('uuid');
const Restaurant = require('../models/restaurant');
const Food = require('../models/food');
const sendEmail = require('../../helpers/sendMail');
const {io} = require('../../bin/socket')
  







// Function to generate a unique 5-digit numeric order ID
let orderIdCounter = 1;

function generateShortOrderId() {
  // Use timestamp and counter to create a unique order ID  
  const timestamp = Date.now();
  const uniqueId = orderIdCounter++;

  // Combine timestamp and counter, and take the last 5 digits
  const orderId = parseInt(`${timestamp}${uniqueId}`.slice(-5));

  return orderId;
}

const placeOrder = Asyncly(async (req, res) => {
	try {
			const orderData = orderValidation.placeOrderSchema.parse(req.body);
			const userId = req.user.id;


			const user = await User.findById(userId);

			if (!user || !user.isActive) {
					throw new ApiError(
							httpStatus.BAD_REQUEST,
							'User is not active or does not exist',
					);
			}

			const recentAddresses = await DynamicAddress.aggregate([
					{ $match: { userid: userId } },
					{ $sort: { createdAt: -1 } },
					{ $limit: 1 },
			]);

			// Generate a unique order ID
			const orderId = generateShortOrderId();

			// Include orderId in orderData
			orderData.orderId = orderId;
			 // Populate the foodId field with the entire food object
			 orderData.orderItems = await Promise.all(orderData.orderItems.map(async (item, index) => {
				const food = await Food.findById(item.foodId);
			
			
				console.log(`Food Price: ${food ? food.price : 'Food not found or price is undefined'}`);
				if (!food || !food.price) {
						console.error(`Error: Food not found or price is undefined for order item ${index + 1}`);
						return null; // Skip this order item
				} 
				// Calculate quantity based on received price and food price
				const quantity = Math.floor(item.price / food.price);
				console.log(`Calculated Quantity: ${quantity}`);
				return { ...item, quantity, food, objectId: food._id  };
		}));

		// Remove any null or undefined order items
		orderData.orderItems = orderData.orderItems.filter(item => item !== null);

			if (recentAddresses.length > 0) {
					const recentAddress = recentAddresses[0];
					orderData.deliveryAddress = recentAddress._id;
			} else {
					throw new ApiError(
							httpStatus.NOT_FOUND,
							'No recent address found for the user',
					);
			}


			if (orderData.paymentMethod === 'Card') {
					const totalAmount = orderData.grandTotal * 100;
					const paystackResponse = await initiatePaystackTransaction(user.email, totalAmount);

					// Create a new order instance
					const order = new Order({ ...orderData, orderId, userId });

					order.orderItems = orderData.orderItems;

					await order.save();
					await Cart.deleteMany({ userId });
					return res.status(httpStatus.OK).json({ data: paystackResponse });

			} else if (orderData.paymentMethod === 'Transfer') {
					// Add wallet balance check code here if needed
					// const userBalance = user.wallet.balance;
					// if (userBalance < orderData.grandTotal) {
					//     return res.status(httpStatus.BAD_REQUEST).json({
					//         error: 'Wallet balance is low, fund your wallet to complete this order'
					//     });
					// }

					// Deduct order amount from wallet balance
					// const walletBalance = user.wallet.balance - orderData.grandTotal;
					// user.wallet.balance = walletBalance;

					// Save user with updated wallet balance
					// await user.save();

					user.fcmToken = orderData.fcm_device_token;
					await user.save();

					const paymentStatus = 'Completed'

					const order = new Order({ ...orderData, userId }); 

					order.orderItems = orderData.orderItems; 
						// Fetch restaurant details based on restaurantId from req.body
						const restaurantId = orderData.restaurantId;
					
						const restaurant = await Restaurant.findById(restaurantId);
						if (!restaurant) {
								throw new ApiError(
										httpStatus.NOT_FOUND,
										'Restaurant not found',
								);
						}
	
					
					const message = 'You have a new order!'; 
		// Emit the newOrders event with a notification message and the order ID
       io.emit('newOrders', { message, orderId, restaurantId });


					const savedOrder = await order.save();         
					// io.emit('newOrder', { orderId: order.orderId});
					// console.log(orderId)
				
				
	 

				
					// Send order notification and push notifications only if payment method is 'Transfer'
					// await sendOrderNotificationAndPushNotification(orderData, userId);
			// 

					
				// Send order notification email to the restaurant
          // await sendOrderNotificationEmail(user.email, restaurant.email, orderData, userId);


					// Delete user's cart after successful order placement
					// await Cart.deleteMany({ userId });
					const referenceId = uuidv4().slice(0, 6);
					const transaction = await Transaction.create({
							amount: orderData.grandTotal,
							status: 'Successful',
							transactionType: 'Transfer',
							transactionName: 'Order', 
							orderId: order.orderId, // Add orderId here
							reference: referenceId,
							userId,
					});

            return res.status(httpStatus.CREATED).json({ message: 'Order has been received and payment confirmed', orderId,  order: savedOrder});

				
			}
	} catch (error) {
			console.error('Error placing order:', error.message);
			return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Error placing order' });
	}
});





const sendOrderNotificationAndPushNotification = async (orderData, userId) => {
	try {
			const { fcm_device_token, restaurantId } = orderData;

			// Send push notification to the user
			const user = await User.findById(userId); // Fetch user details
			if (user && user.fcmToken) {
					const notificationToUser = {
							title: 'Payment Successful!',
							body: 'You have successfully placed an order. \nYou will get a notification when your order is confirmed by the restaurant',
					};
					await sendPushNotification(user.fcmToken, notificationToUser);
			}

			// Send order notification and push notification to the restaurant
			if (restaurantId) {
					const restaurant = await Restaurant.findById(restaurantId); 
					if (restaurant && restaurant.fcm_device_token) {
							const notificationToRestaurant = {
									title: 'New Order Received!',
									body: `New order received from ${user ? user.username : 'Unknown User'}. Please check your dashboard for details.`,
							};
							await sendPushNotification(restaurant.fcm_device_token, notificationToRestaurant);
							await sendOrderNotificationEmail(restaurant.email, orderData);
					}
			}
			return res.status(httpStatus.CREATED).json({ message: 'Order has been received and payment confirmed', orderId, order });
	} catch (error) {
			console.error('Error sending order notification and push notification:', error.message);
	}
};


const sendOrderNotificationEmail = async (userEmail, restaurantEmail, orderData, userId) => {
	try {
			const user = await User.findById(userId);

			if (!user) {
					throw new ApiError(
							httpStatus.NOT_FOUND,
							'User not found',
					);
			}

			const subject = 'Your Order Receipt';
			const orderedItemsList = orderData.orderItems.map(item => {
					// Map the additives for each item
					const additivesList = item.food.additives.map(additive => `<li>${additive.name}</li>`).join('');
					return `
							<li>
									${item.food.title} - ${item.quantity}
									<ul>${additivesList}</ul>
							</li>
					`;
			}).join('');

			const userMessage = `
    <h1>Your Order Receipt</h1>
    <p>Thank you for placing your order with us. Here are the details of your order:</p>
    <p>Order ID: ${orderData.orderId}</p>
    <p>Total Amount: ${orderData.orderTotal}</p>
    <p>Ordered Items:</p>
    <ul>
        ${orderData.orderItems.map(item => `
            <li>
                <div>
                    <img src="${item.food.image}" alt="${item.food.title}" style="max-width: 100px;">
                    <div>
                        <p>${item.food.title} - ${item.quantity}</p>
                    </div>
                </div>
            </li>
        `).join('')}
    </ul>
    <p>We appreciate your business. Please let us know if you have any questions or concerns.</p>
`;

const restaurantMessage = `
    <h1>New Order Received</h1>
    <p>A new order has been received with the following details:</p>
    <p>Order ID: ${orderData.orderId}</p>
    <p>Customer Name: ${user.username}</p>
    <p>Total Amount: ${orderData.orderTotal}</p>
    <p>Ordered Items:</p>
    <ul>
        ${orderData.orderItems.map(item => `
            <li>
                <div>
                    <img src="${item.food.image}" alt="${item.food.title}" style="max-width: 100px;">
                    <div>
                        <p>${item.food.title} - ${item.quantity}</p>
                        <p>${item.food.description}</p>
                    </div>
                </div>
            </li>
        `).join('')}
    </ul>
    <p>Please check your dashboard for details.</p>
`;


			await Promise.all([
					sendEmail({ to: userEmail, subject: subject, text: userMessage }),
					sendEmail({ to: restaurantEmail, subject: subject, text: restaurantMessage })
			]);

			console.log(`Order receipt email sent to user: ${userEmail}`);
			console.log(`Order notification email sent to restaurant: ${restaurantEmail}`);
	} catch (error) {
			console.error('Error sending order emails:', error.message);
	}
};






const getOrderDetails = Asyncly(async (req, res) => {
	const orderId = req.params.id;
    {
			const order = await Order.findById(orderId)
					.populate({
							path: 'userId',
							select: 'username email phoneNumber',
					})
					.populate({
							path: 'deliveryAddress',
							select: 'address state city code',
					})
					.populate({
							path: 'restaurantId',
							select: 'restaurantName address',
					})
					.populate({
							path: 'assignedDriver',
							select: 'username image email phoneNumber',
					})
					.populate({
							path: 'orderItems.additives', // Populate the additives field within orderItems
							model: 'Additive', // Specify the model to use for population
							select: 'name price', // Select the name field
					})
					.populate({
							path: 'orderItems.foodId',
							select: 'title image price discount ', // Include additives here
					});

			if (!order) {
					throw new ApiError(httpStatus.NOT_FOUND, 'Order not found');
			}

			res.status(httpStatus.OK).json(order);
	// } catch (error) {
	// 		console.error(error);
	// 		throw new ApiError(
	// 				httpStatus.INTERNAL_SERVER_ERROR,
	// 				'Error retrieving order details'
	// 		);
	}
});



const getSumDeliveredOrders = Asyncly(async (req, res) => {
	try {
		// const deliveredOrders = await Order.find({ orderStatus: "DELIVERED" });

		// If orderStatus is not a string, adjust the query accordingly
		const deliveredOrders = await Order.find({
			orderStatus: { $eq: 'DELIVERED' },
		});

		console.log('Delivered Orders:', deliveredOrders);

		const sumDeliveredOrders = deliveredOrders.length;

		res.json({ sumDeliveredOrders });
	} catch (error) {
		console.error(error);
		throw new ApiError(
			httpStatus.INTERNAL_SERVER_ERROR,
			'Error calculating sum of delivered orders',
		);
	}
});
const getUserOrders = Asyncly(async (req, res) => {
	const userId = req.params.id;

	// Populate and format orders
	const orders = await Order.find({ userId })
			.populate({
					path: 'deliveryAddress',
					select: 'address state city',
			})
			.populate({
					path: 'orderItems',
					populate: {
							path: 'additives', // Populate the additives field within orderItems
							select: 'name price',
					},
			})
			.populate({
					path: 'orderItems.foodId',
					select: 'title image price',
			})  .populate({
        path: 'orderItems.additives', // Populate the additives field
        select: 'name price', // Specify the fields you want to select from the Additive model
    })
			.populate({
					path: 'restaurantId',
					select: 'restaurantName address',
			})
			.populate({
					path: 'assignedDriver',
					select: 'username phoneNumber image coordinates',
			})
			.select(
					'orderId grandTotal  orderItems orderDate paymentMethod orderStatus',
			);

	// Transform the data to the desired format
	const formattedOrders = orders.map((order) => {
			const formattedOrder = {
					orderId: order.orderId,
					grandTotal: order.grandTotal,
					orderItems: order.orderItems.map((item) => ({
							additives: item.additives, // Now additives should be populated
							foodId: item.foodId ? item.foodId._id : null,
							foodPrice: item.foodId ? item.foodId.price : null,
							foodTitle: item.foodId ? item.foodId.title : null,
							foodImage: item.foodId ? item.foodId.image : null,
							quantity: item.quantity,
							price: item.price,
					})),
					orderDate: order.orderDate, 
					paymentMethod: order.paymentMethod,
					orderStatus: order.orderStatus,
					restaurantName: order.restaurantId ? order.restaurantId.restaurantName : null,
					pickUpLocation: order.restaurantId ? order.restaurantId.address : null,
					drpOffLocation: order.deliveryAddress ? order.deliveryAddress.address : null,
					assignedDriver: order.assignedDriver,
			};

			return formattedOrder;
	});

	res.status(httpStatus.OK).json(formattedOrders || []);
});





const rateOrders = Asyncly(async (req, res) => {
	const orderId = req.params.id;
	const { rating, comment } = req.body;

	const updatedOrder = await Order.findByIdAndUpdate(
		orderId,
		{ rating, comment },
		{ new: true },
	);

	if (!updatedOrder) {
		throw new ApiError(httpStatus.NOT_FOUND, 'Failed to update order');
	}

	res
		.status(httpStatus.OK)
		.json({ status: true, message: 'Order updated successfully' });
});
const getRestaurantOrderss = Asyncly(async (req, res) => {
	const { restaurantId } = req.params;

	const orders = await Order.find({ restaurantId, paymentStatus: 'Completed' })
		.populate({
			path: 'userId',
			select: 'username email phoneNumber',
		})
		.populate({  
			path: 'deliveryAddress',
			select: 'address state city code',
		})
		.populate({
			path: 'orderItems.additives',
			select: 'image name price',
		})
		.populate({
			path: 'restaurantId',
			select: 'restaurantName address',
		})
		.populate({
			path: 'assignedDriver', 
			select: 'username phoneNumber image email',
		})
		.populate({
			path: 'orderItems.foodId',
			select: 'title image additives price discount',
		}).sort({ orderDate: -1 }); ;

	if (orders.length === 0) {
		throw new ApiError(
			httpStatus.NOT_FOUND,
			'No orders found for the restaurant',
		);
	}

	const formattedOrders = orders.map((order) => {
		const formattedOrderItems = order.orderItems.map((item) => {
			// Check if foodId exists before accessing its properties
			const formattedFoodName = item.foodId?.title || 'Unknown Food';
			const formattedFoodImage = item.foodId?.image || 'default_image_url';
			const formattedFoodPrice = item.foodId?.price || 0;
			const formattedFoodDiscount = item.foodId?.discount || 0;
	
			// Check if additives exist before accessing
			const formattedAdditives = item.additives
				? item.additives.map((additive) => ({
						image: additive?.image || 'default_additive_image_url',
						name: additive?.name || 'Unknown Additive',
						price: additive?.price || 0,
					}))
				: [];
	
			return {
				foodName: formattedFoodName,
				foodImage: formattedFoodImage,
				foodPrice: formattedFoodPrice,
				fooddiscount: formattedFoodDiscount,
				quantity: item.quantity,
				price: item.price,
				additives: formattedAdditives,
				instructions: item.instructions,
			};
		});
	
		return {
			_id: order._id,
			orderId: order.orderId,
			userName: order.userId ? order.userId.username : '',
			userEmail: order.userId ? order.userId.email : '',
			userPhoneNumber: order.userId ? order.userId.phoneNumber : '',
			deliveryAddress: order.deliveryAddress,
			restaurantName: order.restaurantId.restaurantName,
			restaurantAddress: order.restaurantId.address,
			assignedDriver: order.assignedDriver,
			orderStatus: order.orderStatus, 
			orderDate: order.orderDate, 
			totalAmount: order.orderTotal,
			orderItems: formattedOrderItems,
		};
	});
	

	res.status(httpStatus.OK).json(formattedOrders);
});



const getAllOrders = Asyncly(async (req, res) => {
	const orders = await Order.find()
		.populate({
			path: 'userId',
			select: 'username email phoneNumber',
		})
		.populate({
			path: 'deliveryAddress',
			select: 'address state city code',
		})
		.populate({
			path: 'restaurantId',
			select: 'restaurantName address',
		})
		.populate({
			path: 'assignedDriver',
			select: 'username phoneNumber image ',
		});

	if (orders.length === 0) {
		throw new ApiError(httpStatus.NOT_FOUND, 'No orders found');
	}

	res.status(httpStatus.OK).json(orders);
});

const getDriverOrders = Asyncly(async (req, res) => {
	const { driverId } = req.params;

	const orders = await Order.find({ assignedDriver: driverId ,paymentStatus: 'Completed'})
		.populate({
			path: 'userId',
			select: 'username  phoneNumber',
		})
		.populate({
			path: 'deliveryAddress',
			select: 'address state city code',
		})
		.populate({
			path: 'restaurantId',
			select: 'restaurantName address',
		})
		.populate({
			path: 'assignedDriver',
			select: 'username phoneNumber',
		});

	if (orders.length === 0) {
		throw new ApiError(httpStatus.NOT_FOUND, 'No orders found for the driver');
	}

	res.status(httpStatus.OK).json(orders);
});


const deleteFirstSeventyOrders = async () => {
	try {
			// Fetch the first 70 orders from the database
			const ordersToDelete = await Order.find().limit(20);

			// Delete the fetched orders
			await Order.deleteMany({ _id: { $in: ordersToDelete.map(order => order._id) } });

			console.log('Successfully deleted the first 70 orders.');
	} catch (error) {
			console.error('Error deleting orders:', error);
	}
};

// Call the function to delete the first 70 orders
// deleteFirstSeventyOrders();




module.exports = {
	getSumDeliveredOrders,
	getRestaurantOrderss,
	placeOrder,
	getOrderDetails,
	getUserOrders,
	rateOrders,
	getAllOrders,
	getDriverOrders,
};
