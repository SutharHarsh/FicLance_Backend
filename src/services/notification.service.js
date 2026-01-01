const logger = require('../config/logger');
const config = require('../config/env');
const { User } = require('../models');

class NotificationService {
  /**
   * Send an email notification
   * @param {string} to - Recipient email
   * @param {string} subject - Email subject
   * @param {string} body - Email body (HTML or text)
   */
  async sendEmail(to, subject, body) {
    try {
      // In production, integrate with SES/SendGrid
      // For now, log it
      logger.info(`[Email Notification] To: ${to} | Subject: ${subject}`);
      
      if (config.app.isDevelopment) {
        logger.debug(`[Email Body]: ${body}`);
      }

      // Record in DB if needed (SimulationNotification model?)
      return true;
    } catch (error) {
      logger.error('Failed to send email:', error);
      return false;
    }
  }

  /**
   * Send a push notification
   * @param {string} userId - User ID to send to
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   * @param {object} data - Extra data payload
   */
  async sendPush(userId, title, message, data = {}) {
    try {
      const user = await User.findById(userId);
      if (!user) return false;

      // In production, integrate with Firebase/OneSignal
      // For now, emit via Socket.IO if user is connected
      const { getIO } = require('../socket'); // localized require to avoid circular dependency
      const io = getIO();
      
      if (io) {
        io.to(`user:${userId}`).emit('notification:push', {
          title,
          message,
          data,
          timestamp: new Date(),
        });
        logger.info(`[Push Notification] Sent via Socket to user ${userId}`);
      } else {
        logger.warn(`[Push Notification] Skipped - Socket IO not initialized`);
      }

      return true;
    } catch (error) {
      logger.error('Failed to send push notification:', error);
      return false;
    }
  }

  /**
   * Notify user about simulation completion
   */
  async notifySimulationCompletion(userId, simulation) {
    const user = await User.findById(userId);
    if (!user) return;

    // Email
    await this.sendEmail(
      user.email,
      `Simulation Complete: ${simulation.projectName}`,
      `Your simulation "${simulation.projectName}" has been completed successfully. Check out your score!`
    );

    // Push
    await this.sendPush(
      userId,
      'Simulation Completed',
      `Your simulation "${simulation.projectName}" is ready with a score of ${simulation.meta.score}.`
    );
  }
}

module.exports = new NotificationService();
