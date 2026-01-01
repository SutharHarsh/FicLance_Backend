/**
 * Beta Mode Utilities
 * Centralized beta mode detection for the application
 */

const config = require("../config/env");

/**
 * Check if the application is running in beta mode
 * @returns {boolean} True if beta mode is enabled
 */
function isBetaMode() {
  return config.isBetaMode === true;
}

module.exports = {
  isBetaMode,
};
