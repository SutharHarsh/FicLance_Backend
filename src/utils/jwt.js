const jwt = require('jsonwebtoken');
const config = require('../config/env');
const logger = require('../config/logger');

class JWTUtil {
  /**
   * Generate access token
   * @param {Object} payload - Token payload (userId, email, role)
   * @returns {String} JWT token
   */
  generateAccessToken(payload) {
    try {
      return jwt.sign(payload, config.jwt.accessSecret, {
        expiresIn: config.jwt.accessTTL,
        issuer: 'ficlance-api',
        audience: 'ficlance-client',
      });
    } catch (error) {
      logger.logError(error, { context: 'generateAccessToken' });
      throw error;
    }
  }

  /**
   * Generate refresh token (secure random string)
   * @returns {String} Random hex token
   */
  generateRefreshToken() {
    const crypto = require('crypto');
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Verify access token
   * @param {String} token - JWT token
   * @returns {Object} Decoded payload
   */
  verifyAccessToken(token) {
    try {
      return jwt.verify(token, config.jwt.accessSecret, {
        issuer: 'ficlance-api',
        audience: 'ficlance-client',
      });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Access token expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid access token');
      }
      throw error;
    }
  }

  /**
   * Verify refresh token
   * @param {String} token - JWT token
   * @returns {Object} Decoded payload
   */
  verifyRefreshToken(token) {
    try {
      return jwt.verify(token, config.jwt.refreshSecret, {
        issuer: 'ficlance-api',
        audience: 'ficlance-client',
      });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Refresh token expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid refresh token');
      }
      throw error;
    }
  }

  /**
   * Decode token without verification (for debugging)
   * @param {String} token - JWT token
   * @returns {Object} Decoded payload
   */
  decode(token) {
    return jwt.decode(token);
  }
}

module.exports = new JWTUtil();
