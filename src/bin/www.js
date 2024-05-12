const http = require('http');
const app = require('../../index'); // Import the Express app
const connect = require('../config/connectDb');
const logger = require('../config/logger');
// const { io } = require('./socket'); // Import io from socket.js
const config = require('../config/env');
const server = http.createServer(app);


// Start the application
const startApp = async () => { 
    try {
        // Connect to the database
        await connect.connectDb();
        logger.info(`\x1b[32mDB:\x1b[0m MongoDB Connected`);
        logger.info(`\x1b[36mServer:\x1b[0m Starting server...`);

        // Start the server
        server.listen(config.PORT, () => {
            logger.info(`\x1b[36mServer:\x1b[0m Server started on port ${config.PORT}`);         
        });
    } catch (error) {
        logger.error(` ${error.message}`);    
        shutdown();
    }
}; 


// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    logger.error(err.name, err.message);
    logger.error('Uncaught Exception occurred! Shutting down...');
    shutdown();
});

// Handle server errors
server.on('error', onError);

// Handle unhandled rejections
process.on('unhandledRejection', (err) => {
    logger.error(err.name, err.message);
    logger.error('Unhandled rejection occurred! Shutting down...');
    shutdown();
});

// Handle SIGTERM signal
process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Shutting down gracefully');
    shutdown();
});

// Shutdown function
function shutdown() {
    server.close(() => {
        logger.info('Closed out remaining connections');
        process.exit(1);
    });
}

// Handle server errors
function onError(error) {
    if (error.syscall !== 'listen') {
        logger.error(error);
        return;
    }

    const bind = typeof PORT === 'string' ? Pipe `${config.PORT} : Port ${config.PORT}` : `PID ${process.pid}`;

    switch (error.code) {
        case 'EACCES':
            logger.error(`${bind} requires elevated privileges`);
            break;
        case 'EADDRINUSE':
            logger.error(`${bind} is already in use`);    
            break;
        default:
            logger.error(error);
    }

    shutdown();
}

// Handle WebSocket connections
// io.on('connection', (socket) => {
//     logger.info('A user connected');

//     // Handle incoming messages
//     socket.on('message', (message) => {
//         logger.info(`Received message from client: ${message}`);
//         // Handle incoming messages from clients here
//     });

//     // Handle disconnection
//     socket.on('disconnect', () => {
//         logger.info('A user disconnected');
//     });
// });
    
// Start the application    
startApp();   
// module.exports = {io}   
 
