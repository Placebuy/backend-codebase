const express = require('express');

const authRoute = require('./auth');
const productRoute = require('./products');
const reviewRoute = require('./reviews')
// const adminRoute = require('./adminRoute');
// const cartRoute = require('./cartRoute');
// const categoriesRoute = require('./categoriesRoute');
// const companyRoute = require('./companyRoute');
// const driverRoute = require('./driverRoute');
// const foodRoute = require('./foodRoute');
// const locationRoute = require('./locationRoute');
// const orderRoute = require('./orderRoute');
// const restaurantRoute = require('./restaurantRoute');
// const menuRoute = require('./menuRoute');
// const superAdminRoute = require('./superAdminRoute');
// const userRoute = require('./userRoute');
// const ratingRoute = require('./ratingRoute');
// const transactionRoute = require('./transactionRoute');
// const disputeRoute = require('./disputeRoute');
// const restaurantWalletRoute = require('./restaurantWalletRoute');
// const walletRoute = require('./walletRoute');

const router = express.Router();

const defaultRoutes = [
  {
    path: '/auth',
    route: authRoute,
  },
  {
    path: '/products',
    route: productRoute,
  },
  {
		path: '/reviews',
		route: reviewRoute,
	},
	/**{
		path: '/category',
		route: categoriesRoute,
	},
	{
		path: '/user',
		route: userRoute,
	},
	{
		path: '/orders',
		route: orderRoute,
	},
	{
		path: '/driver',
		route: driverRoute,
	},
	{
		path: '/location',
		route: locationRoute,
	},
	{
		path: '/foods',
		route: foodRoute,
	},
	{
		path: '/cart',
		route: cartRoute,
	},
	{
		path: '/company',
		route: companyRoute,
	},
	{
		path: '/superAdmin',
		route: superAdminRoute,
	},
	{
		path: '/admin',
		route: adminRoute,
	},
	{
		path: '/rating',
		route: ratingRoute,
	},
	{
		path: '/transaction',
		route: transactionRoute,
	},
	{
		path: '/dispute',
		route: disputeRoute,
	},
	{
		path: '/restaurantWallet',
		route: restaurantWalletRoute,
	},
	{
		path: '/wallet',
		route: walletRoute,
	},*/
];

defaultRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

module.exports = router;
