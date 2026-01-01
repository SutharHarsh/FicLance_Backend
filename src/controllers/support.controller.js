const emailService = require('../services/email.service');
const User = require('../models/User');
const logger = require('../config/logger');

class SupportTicketController {
  /**
   * Submit a support ticket (Production-grade, non-blocking)
   * Architecture:
   * 1. Validate request immediately
   * 2. Return HTTP 201 success response
   * 3. Send email ASYNCHRONOUSLY (fire-and-forget)
   * 4. Email failure does NOT affect API response
   */
  async submitTicket(req, res) {
    try {
      const { subject, category, description } = req.body;

      // Validation
      if (!subject || !description) {
        return res.status(400).json({
          success: false,
          message: 'Subject and description are required',
        });
      }

      // Validate lengths
      if (subject.length > 200) {
        return res.status(400).json({
          success: false,
          message: 'Subject must be less than 200 characters',
        });
      }

      if (description.length > 5000) {
        return res.status(400).json({
          success: false,
          message: 'Description must be less than 5000 characters',
        });
      }

      // Get user info if authenticated
      let userEmail = null;
      let userName = null;
      
      if (req.user && req.user.userId) {
        try {
          const user = await User.findById(req.user.userId);
          if (user) {
            userEmail = user.email;
            userName = user.name || user.username;
          }
        } catch (userError) {
          // Log but don't fail - guest tickets are allowed
          logger.warn('Failed to fetch user info for ticket', {
            userId: req.user.userId,
            error: userError.message,
          });
        }
      }

      // Generate reference ID immediately
      const referenceId = `FL-${Date.now()}-${Math.floor(Math.random() * 9000) + 1000}`;

      // Log ticket submission
      logger.info('Support ticket submitted', {
        referenceId,
        subject,
        category: category || 'General',
        userEmail,
        userName,
      });

      // CRITICAL: Respond to client IMMEDIATELY
      // Do NOT await email sending - it happens async
      const response = {
        success: true,
        message: 'Support ticket submitted successfully. Our team will respond within 24 hours.',
        referenceId,
      };

      // Send response to client NOW
      res.status(201).json(response);

      // Send email AFTER response (non-blocking, fire-and-forget)
      // This happens in the background and won't delay the API response
      setImmediate(async () => {
        try {
          await emailService.sendSupportTicketEmail({
            id: referenceId,
            user: {
              name: userName || 'Guest User',
              email: userEmail || 'no-email@ficlance.com',
            },
            subject,
            category: category || 'General',
            description,
            createdAt: new Date(),
          });
        } catch (emailError) {
          // Email failure is logged but doesn't affect the ticket submission
          logger.error('Failed to send support ticket email (non-critical)', {
            referenceId,
            error: emailError.message,
            stack: emailError.stack,
          });
        }
      });

    } catch (error) {
      logger.error('Error in support ticket controller', {
        error: error.message,
        stack: error.stack,
      });

      return res.status(500).json({
        success: false,
        message: 'An error occurred while submitting your ticket. Please try again.',
      });
    }
  }
}

module.exports = new SupportTicketController();
