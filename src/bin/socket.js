const { Server } = require("socket.io");
const http = require('http');
const config = require('../config/auth');

const httpServer = http.createServer();
const io = new Server(httpServer, { cors: { origin: "*" } });

// Specify a different port for Socket.IO
const socketPort = 3001; // Choose any available port
httpServer.listen(socketPort, () => {
    console.log(`Socket.IO server listening on port ${socketPort}`);
});

// Handle WebSocket connections
io.on('connection', (socket) => {
    console.log('A user connected');

    // Handle incoming messages
    socket.on('message', (message) => {
        console.log(`Received message from client: ${message}`);
        // Handle incoming messages from clients here
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});
module.exports = {io}