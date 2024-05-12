const express = require('express'); // Import Express
const helmet = require('helmet'); // Security middleware
const http = require('http'); // Node's built-in HTTP module
const expressWinston = require('express-winston'); // Express middleware for logging
const { transports, format } = require('winston'); // Logging library
const xss = require('xss-clean'); // Middleware for preventing XSS attacks
const cors = require('cors'); // Cross-Origin Resource Sharing middleware
const bodyParser = require('body-parser'); // Middleware for parsing request bodies
const httpStatus = require('http-status'); // HTTP status codes
const createError = require('http-errors'); // Module for creating HTTP errors
const fileUpload = require('express-fileupload'); // Middleware for handling file uploads
const cloudinary = require('cloudinary').v2; // Cloudinary SDK for image uploads
const swaggerUi = require('swagger-ui-express'); // Middleware for serving Swagger UI
const mongoose = require('mongoose'); // MongoDB ODM
const path = require('path'); // Node's path module
const YAML = require('yaml'); // YAML parser
require('dotenv').config(); // Load environment variables
const logger = require('morgan'); // HTTP request logger middleware
const config = require('./src/config/env'); // Configuration variables
const morgan = require('./src//config/morgan'); // Morgan configuration
const { errorConverter, errorHandler } = require('./src/middleware/errorHandler'); // Error handling middleware
const authLimiter = require('./src/middleware/rateLimiter'); // Rate limiter middleware
const ApiError = require('./src/utils/ApiError'); // Custom API error class
const swaggerFile = require('./src/documentation/swagger'); // Swagger documentation file
const apiRouter = require('./src/router/index'); // API router
 // Socket.IO for WebSocket support

// Initialize Express
const app = express();

// Middleware setup
app.use(logger('dev')); // HTTP request logger
app.use(bodyParser.json()); // Parse JSON request bodies
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: false })); // Parse URL-encoded request bodies
app.use(fileUpload({ useTempFiles: true, tempFileDir: '/tmp/' })); // Handle file uploads
cloudinary.config({ // Cloudinary configuration
  cloud_name: config.cloudName,
  api_key: config.apiKey,
  api_secret: config.apiSecret,
  secure: true,
});
app.use(helmet.xssFilter()); // Set X-XSS-Protection header
app.use(xss()); // XSS attack prevention
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.options('*', cors()); // Enable pre-flight requests for all routes
if (config.env !== 'test') {
  app.use(morgan.successHandler); // Log successful requests
  app.use(morgan.errorHandler); // Log errors
}
if (config.env === 'production') {
  app.use('/auth', authLimiter); // Rate limit authentication requests
}
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(YAML.parse(swaggerFile, 'utf8'))); // Serve Swagger UI documentation

// Error handling middleware
app.use(errorHandler);
app.use(errorConverter);

// Routes
app.use('/api/v1/', apiRouter); // API routes
app.get('/', (req, res) => {
  res.send('Hello World and Welcome !'); // Root route response
});
app.all('*', (req, res, next) => {
  next(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Can't find ${req.originalUrl} on this server!`, httpStatus.NOT_FOUND)); // Handle undefined routes
});
app.use((req, res, next) => {
  next(createError(404)); // Handle 404 errors
});
app.use((err, req, res, next) => {
	// Check if the error is a CastError and if it occurred while casting the _id field
	if (err instanceof mongoose.CastError && err.path === '_id') {
	  // Respond with a custom error message or status code for invalid ID
	  return res.status(400).json({ error: 'Invalid ID' });
	}
  
	// For other errors, delegate to the default error handler
	next(err);
  });


app.use((err, req, res, next) => {
  const statusCode = err instanceof ApiError ? err.statusCode : 500;
  res.status(statusCode).json({ error: err.message }); // Handle errors and send JSON response
});

// Express Winston error logger
const myFormat = format.printf(({ level, meta, timestamp }) => `${timestamp} ${level}: ${meta.message}`);
app.use(expressWinston.errorLogger({
  transports: [
    new transports.File({ filename: 'logs/error.log' }) // Log errors to a file
  ],
  format: format.combine(format.json(), format.timestamp(), myFormat)
}));

// Create HTTP server
// const server = http.createServer(app);

// Initialize Socket.IO and attach it to the HTTP server


// Export the Express app
module.exports = app;
