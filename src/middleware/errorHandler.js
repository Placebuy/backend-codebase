const { MongoError } = require('mongodb');
const mongoose = require('mongoose');
const httpStatus = require('http-status');
const config = require('../config/env');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

const errorConverter = (err, req, res, next) => {
    if (!(err instanceof ApiError)) {
        const statusCode = err.statusCode || httpStatus.INTERNAL_SERVER_ERROR;
        const message = err.message || httpStatus[statusCode];
        err = new ApiError(statusCode, message, false);
    }
    next(err);
};

const errorHandler = (err, req, res, next) => {
    let { statusCode, message } = err;

    // Handle MongoDB duplicate key error
    if (err instanceof MongoError && err.code === 11000) {
        statusCode = httpStatus.CONFLICT;
        message = 'Duplicate key error';
    }
    // Handle invalid MongoDB ObjectID error
    else if (err instanceof mongoose.Error.CastError && err.kind === 'ObjectId') {
        statusCode = httpStatus.BAD_REQUEST;
        message = 'Invalid MongoDB ObjectID';
    }
    // Handle other database errors
    else if (err instanceof MongoError || err.name === 'DatabaseError') {
        statusCode = httpStatus.INTERNAL_SERVER_ERROR;
        message = 'Database error';
    } else if (config.env === 'production' && !err.isOperational) {
        statusCode = httpStatus.INTERNAL_SERVER_ERROR;
        message = httpStatus[httpStatus.INTERNAL_SERVER_ERROR];
    }

    res.locals.errorMessage = err.message;

    const response = {
        error: 'error',
        code: statusCode,
        message,
        ...(config.env === 'development' && {
            stack: err.stack,
            originalError: err,
        }),
    };

    if (config.env === 'development') {
        logger.error(err);
    }

    res.setHeader('Content-Type', 'application/json');
    return res.status(statusCode).json(response);
};

module.exports = { errorConverter, errorHandler };
