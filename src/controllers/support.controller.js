const emailService = require('../services/email.service');
const User = require('../models/User');

class SupportTicketController {
  /**
   * Submit a support ticket
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

      // Get user info if authenticated
      let userEmail = null;
      let userName = null;
      
      if (req.user && req.user.userId) {
        const user = await User.findById(req.user.userId);
        if (user) {
          userEmail = user.email;
          userName = user.name || user.username;
        }
      }

      // Send email
      const result = await emailService.sendSupportTicketEmail({
        subject,
        category: category || 'Technical issue',
        description,
        userEmail,
        userName,
      });

      return res.status(200).json({
        success: true,
        message: 'Support ticket submitted successfully',
        referenceId: result.referenceId,
      });
    } catch (error) {
      console.error('Error submitting support ticket:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to submit support ticket',
        error: error.message,
      });
    }
  }
}

module.exports = new SupportTicketController();
