const jwt = require('jsonwebtoken');
const User = require('../models/users');
const logger = require('../config/logger');
const httpStatus = require('http-status');

require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.sendStatus(401);
  const token = authHeader.split(' ')[1];
  jwt.verify(token, JWT_SECRET, async (err, user) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Token has expired' });
      }
      return res.status(403).json({ message: 'Invalid token' });
    }
    //req.restaurantId = user.restaurantId
    req.userId = user.id;
    req.user = user;
    next();
  });
};

const requireAuth = async (req, res, next) => {
  verifyToken(req, res, async () => {
    if (
      req.user.userType === 'Buyer' ||
      req.user.userType === 'Vendor' ||
      req.user.userType === 'Admin'
    ) {
      next();
    } else {
      logger.error('Unauthorized access');
      //return res.status(401).json({ message: 'Unauthorized' });
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Unauthorized')
    }
  });
};

const verifyAdmin = async (req, res, next) => {
  verifyToken(req, res, async () => {
    if (req.user.userType === 'Admin') {
      next();
    } else {
      logger.error('Unauthorized access');
      return res.status(401).json({ message: 'Unauthorized' });
    }
  });
};

const verifyVendor = async (req, res, next) => {
  verifyToken(req, res, async () => {
    if (req.user.userType === 'Vendor') {
      next();
    } else {
      logger.error('Unauthorized access');
      return res.status(401).json({ message: 'Unauthorized' });
    }
  });
};

verifyBuyer = async (req, res, next) => {
  verifyToken(req, res, async () => {
    if (req.user.userType === 'Buyer') {
      next();
    } else {
      logger.error('Unauthorized access');
      return res.status(401).json({ message: 'Unauthorized' });
    }
  });
};

module.exports = {
  requireAuth,
  verifyToken,
  verifyAdmin,
  verifyVendor,
  verifyBuyer,
};
