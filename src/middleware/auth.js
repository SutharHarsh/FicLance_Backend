const { verifyAccessToken } = require('../utils/jwt');
const { AppError } = require('../utils/errors');
const config = require('../config/env');

/**
 * Authentication middleware - verify JWT
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No token provided', 401);
    }
    
    const token = authHeader.substring(7);
    const decoded = verifyAccessToken(token);
    
    req.user = decoded;
    next();
  } catch (error) {
    if (error.message.includes('expired')) {
      return res.status(401).json({
        success: false,
        data: null,
        error: 'Token expired',
      });
    }
    
    return res.status(401).json({
      success: false,
      data: null,
      error: error.message || 'Authentication failed',
    });
  }
}

/**
 * Admin check middleware
 * Checks if user is admin based on ADMIN_USER_IDS env var
 */
function isAdmin(req, res, next) {
  const adminIds = process.env.ADMIN_USER_IDS
    ? process.env.ADMIN_USER_IDS.split(',')
    : [];
  
  const userId = req.user?.userId?.toString();
  
  if (!userId || !adminIds.includes(userId)) {
    return res.status(403).json({
      success: false,
      data: null,
      error: 'Admin access required',
    });
  }
  
  req.user.isAdmin = true;
  next();
}

/**
 * Optional authentication middleware - verify JWT if provided
 * Does not fail if no token is provided
 */
async function optionalAuthenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without user data
      req.user = null;
      return next();
    }
    
    const token = authHeader.substring(7);
    const decoded = verifyAccessToken(token);
    
    req.user = decoded;
    next();
  } catch (error) {
    // Token is invalid, but continue without user data
    req.user = null;
    next();
  }
}

module.exports = {
  authenticate,
  isAdmin,
  optionalAuthenticate,
};
