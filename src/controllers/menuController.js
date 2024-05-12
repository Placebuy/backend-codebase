const httpStatus = require('http-status');
const Asyncly = require('../utils/Asyncly');
const ApiError = require('../utils/ApiError');
const Menu = require('../models/restaurantMenu');

const addMenu = Asyncly(async (req, res) => {
	const {restaurantId} = req.params // Assuming the restaurant ID is provided in the request body

	const newMenu = new Menu({
		...req.body,
		restaurant: restaurantId,
	});

	await newMenu.save();
	res
		.status(httpStatus.OK)
		.json({ status: true, message: 'Menu successfully added' });
});

const getMenusByRestaurant = Asyncly(async (req, res) => {
  const { restaurantId } = req.params;

  // Fetch all menus for the restaurant
  let menus = await Menu.find({ restaurant: restaurantId }).lean();

  // Check if the restaurant has a menu named "All"
  const allMenuIndex = menus.findIndex(menu => menu.name === 'All');

  // If not, create the "All" menu and move it to the beginning
  if (allMenuIndex === -1) {
    const newAllMenu = new Menu({
      name: 'All',
      restaurant: restaurantId,
    });
    await newAllMenu.save();
    menus.unshift(newAllMenu.toObject());
  } else {
    // If "All" menu exists, move it to the beginning
    const allMenu = menus.splice(allMenuIndex, 1)[0];
    menus.unshift(allMenu);
  }

  // Sort the menus based on whether they are the "All" menu or not, and then by creation timestamp
  menus = menus.sort((a, b) => {
    if (a.name === 'All') return -1;
    if (b.name === 'All') return 1;
    return b.createdAt - a.createdAt;
  });

  res.status(httpStatus.OK).json(menus);
});




const getAllMenus = Asyncly(async (req, res) => {
	const menus = await Menu.find();

	res.status(httpStatus.OK).json(menus);
});

const editMenu = Asyncly(async (req, res) => {
	const menuId = req.params.id;
	const { name } = req.body;

	const menu = await Menu.findByIdAndUpdate(
		menuId,
		{ name },
		{ new: true, runValidators: true },
	);

	if (!menu) {
		throw new ApiError(httpStatus.NOT_FOUND, 'Menu not found');
	}

	res.status(httpStatus.OK).json({ status: true, message: 'Menu updated' });
});

const deleteMenuById = Asyncly(async (req, res) => {
	const menuId = req.params.id;

	await Menu.findByIdAndDelete(menuId);
	res
		.status(httpStatus.OK)
		.json({ status: true, message: 'Menu deleted successfully' });
});
const getMenuById = async (req, res) => {
  try {
    const menuId = req.params.id;
    
    // Assuming Menu is your Mongoose model
    const menu = await Menu.findById(menuId);

    if (!menu) {
      return res.status(httpStatus.NOT_FOUND).json({ status: false, message: 'Menu not found' });
    }

    res.status(httpStatus.OK).json({ status: true, data: menu });
  } catch (error) {
    console.error('Error fetching menu:', error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ status: false, message: 'Internal server error' });
  }
};

const menuAvailability = Asyncly(async (req, res) => {
	const menuId = req.params.id;
	const menu = await Menu.findById(menuId);

	if (!menu) {
		throw new ApiError(httpStatus.NOT_FOUND, 'Menu not found');
	}

	// Update menu availability
	menu.isAvailable = !menu.isAvailable;
	await menu.save();

	// Update food availability if menu availability is set to false
	if (!menu.isAvailable) {
		await Menu.updateOne(
			{ _id: menuId },
			{ $set: { 'menuItems.$[].available': false } },
		);
	}

	res
		.status(httpStatus.OK)
		.json({ status: true, message: 'Menu availability updated' });
});

module.exports = {
	addMenu,
	getMenusByRestaurant,
	getAllMenus,
	editMenu,
	deleteMenuById,
	menuAvailability,
	getMenuById
};
