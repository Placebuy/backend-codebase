const mongoose = require('mongoose');
const logger = require('./logger');
require('dotenv').config();
const config = require('./env')


// General container
const conn = {};

mongoose.set('strictQuery');           
conn.connectDb = async () => {
	try {
		const conn = await mongoose.connect(config.dbUrl, {});
		logger.info(
			`\x1b[36m%s\x1b[0m`,
			`DB: MongoDB Connected: ${conn.connection.host}`,
		);
	} catch (error) {
		logger.error(
			`\x1b[31m%s\x1b[0m`,
			`DB: MongoDB Conn Failure: ${error.message}`,
		);
		process.exit(1);
	}   
};    

module.exports = conn;
