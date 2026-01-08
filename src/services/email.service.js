const { Resend } = require('resend');
const logger = require('../config/logger');

class EmailService {
  constructor() {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      logger.warn('RESEND_API_KEY not configured. Email functionality will be disabled.');
      this.resend = null;
      this.isConfigured = false;
      return;
    }

    this.resend = new Resend(apiKey);
    this.isConfigured = true;
    this.supportReceiverEmail = process.env.SUPPORT_RECEIVER_EMAIL || 'support@ficlance.com';
    logger.info('✅ Resend Email Service initialized successfully');
  }

  /**
   * Generate a unique reference ID for email tracking
   */
  generateReferenceId(prefix = 'email') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Escape HTML to prevent XSS in emails
   * @private
   */
  _escapeHtml(text) {
    if (!text) return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, (m) => map[m]);
  }

  /**
   * Send Support Ticket Email
   * Email is sent FROM the user's email address TO the support team
   * This allows the support team to reply directly to the user
   *
   * @param {Object} ticket - Support ticket data
   * @param {string} ticket.id - Ticket reference ID
   * @param {Object} ticket.user - User object
   * @param {string} ticket.user.name - User's full name
   * @param {string} ticket.user.email - User's email address (will be sender)
   * @param {string} ticket.subject - Ticket subject
   * @param {string} ticket.category - Ticket category
   * @param {string} ticket.description - Ticket description
   * @param {Date} ticket.createdAt - Ticket creation timestamp
   * @returns {Promise<Object>} Email send result
   */
  async sendSupportTicketEmail(ticket) {
    if (!this.isConfigured) {
      logger.warn('Email service not configured. Skipping email send.');
      return { success: false, reason: 'Email service not configured' };
    }

    const referenceId = ticket.id || this.generateReferenceId('support');
    const userName = ticket.user?.name || 'Guest User';
    const userEmail = ticket.user?.email || 'no-email@ficlance.com';
    const timestamp = new Date(ticket.createdAt || Date.now()).toLocaleString('en-US', {
      dateStyle: 'full',
      timeStyle: 'long',
    });
    
    try {
      // Use verified sender email (Resend requires verified domains)
      // Display user's name and email in FROM field for easy identification
      // Set reply-to to user's email so support can reply directly
      const senderEmail = process.env.SUPPORT_SENDER_EMAIL || 'onboarding@resend.dev';
      const fromName = `${userName} (${userEmail})`;
      
      const result = await this.resend.emails.send({
        from: `${fromName} <${senderEmail}>`,
        to: this.supportReceiverEmail,
        reply_to: userEmail,  // Support team can reply directly to user
        subject: `[Support Ticket] ${ticket.subject} - ${referenceId}`,
        html: this._generateSupportTicketHtml({
          referenceId,
          userName,
          userEmail,
          subject: ticket.subject,
          category: ticket.category || 'General',
          description: ticket.description,
          timestamp,
        }),
        tags: [
          {
            name: 'category',
            value: 'support-ticket',
          },
        ],
      });

      logger.info('✅ Support ticket email sent successfully', {
        referenceId,
        emailId: result.data?.id,
        from: senderEmail,
        replyTo: userEmail,
        to: this.supportReceiverEmail,
      });

      return {
        success: true,
        emailId: result.data?.id,
        referenceId,
      };
    } catch (error) {
      // Log error but don't throw - email failure should not break the API
      logger.error('❌ Failed to send support ticket email', {
        error: error.message,
        referenceId,
        stack: error.stack,
      });

      return {
        success: false,
        error: error.message,
        referenceId,
      };
    }
  }

  /**
   * Generate HTML template for support ticket email
   * @private
   */
  _generateSupportTicketHtml({ referenceId, userName, userEmail, subject, category, description, timestamp }) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
    }
    .header p {
      margin: 10px 0 0 0;
      opacity: 0.9;
      font-size: 14px;
    }
    .content {
      padding: 30px;
    }
    .field {
      margin-bottom: 20px;
    }
    .label {
      font-weight: 600;
      color: #4b5563;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
      display: block;
    }
    .value {
      background: #f9fafb;
      padding: 12px 16px;
      border-radius: 6px;
      border: 1px solid #e5e7eb;
      font-size: 14px;
      color: #1f2937;
    }
    .reference {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px;
      border-radius: 8px;
      text-align: center;
      font-weight: 700;
      font-size: 18px;
      margin-bottom: 20px;
      font-family: 'Courier New', monospace;
      letter-spacing: 1px;
    }
    .footer {
      text-align: center;
      padding: 20px;
      color: #6b7280;
      font-size: 12px;
      border-top: 1px solid #e5e7eb;
      background: #f9fafb;
    }
    .footer p {
      margin: 5px 0;
    }
    .priority-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      background: #fef3c7;
      color: #92400e;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎫 New Support Ticket</h1>
      <p>FicLance Help Center</p>
    </div>
    
    <div class="content">
      <div class="reference">${referenceId}</div>

      <div class="field">
        <span class="label">Submitted By</span>
        <div class="value">
          ${this._escapeHtml(userName)}<br>
          ${this._escapeHtml(userEmail)}
        </div>
      </div>

      <div class="field">
        <span class="label">Subject</span>
        <div class="value">${this._escapeHtml(subject)}</div>
      </div>

      <div class="field">
        <span class="label">Category</span>
        <div class="value">
          <span class="priority-badge">${this._escapeHtml(category)}</span>
        </div>
      </div>

      <div class="field">
        <span class="label">Description</span>
        <div class="value">${this._escapeHtml(description).replace(/\n/g, '<br>')}</div>
      </div>

      <div class="field">
        <span class="label">Timestamp</span>
        <div class="value">${timestamp}</div>
      </div>
    </div>

    <div class="footer">
      <p><strong>This is an automated email from FicLance Support System</strong></p>
      <p>© ${new Date().getFullYear()} FicLance. All rights reserved.</p>
      <p style="margin-top: 10px; color: #9ca3af;">
        Please respond to this ticket within 24 hours for optimal customer satisfaction.
      </p>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Send Password Reset Email
   * Email is sent FROM system email TO user
   *
   * @param {string} email - User's email address (recipient)
   * @param {string} resetToken - Password reset token
   * @param {string} userName - User's name (optional)
   * @returns {Promise<Object>} Email send result
   */
  async sendPasswordResetEmail(email, resetToken, userName) {
    if (!this.isConfigured) {
      logger.warn('Email service not configured. Skipping email send.');
      return { success: false, reason: 'Email service not configured' };
    }

    const referenceId = this.generateReferenceId('password-reset');

    try {
      const senderEmail = process.env.SUPPORT_SENDER_EMAIL || 'onboarding@resend.dev';
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const resetLink = `${frontendUrl}/auth/reset-password?token=${resetToken}`;

      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
    }
    .content {
      padding: 30px;
    }
    .button {
      display: inline-block;
      padding: 14px 32px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
      font-weight: 600;
      transition: transform 0.2s;
    }
    .button:hover {
      transform: translateY(-2px);
    }
    .link-box {
      word-break: break-all;
      background: #f9fafb;
      padding: 12px;
      border-radius: 6px;
      border: 1px solid #e5e7eb;
      font-size: 13px;
      color: #4b5563;
      font-family: monospace;
    }
    .footer {
      text-align: center;
      padding: 20px;
      color: #6b7280;
      font-size: 12px;
      border-top: 1px solid #e5e7eb;
      background: #f9fafb;
    }
    .warning {
      background: #fef3c7;
      padding: 12px;
      border-radius: 6px;
      border-left: 4px solid #f59e0b;
      margin: 20px 0;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔐 Password Reset Request</h1>
    </div>
    <div class="content">
      <p>Hello${userName ? ' <strong>' + this._escapeHtml(userName) + '</strong>' : ''},</p>
      <p>We received a request to reset your FicLance account password.</p>
      <p>Click the button below to create a new password:</p>
      <p style="text-align: center;">
        <a href="${resetLink}" class="button">Reset Password</a>
      </p>
      <p>Or copy and paste this link into your browser:</p>
      <div class="link-box">${resetLink}</div>
      <div class="warning">
        <strong>⏰ Important:</strong> This link will expire in 1 hour for security reasons.
      </div>
      <p style="color: #6b7280; font-size: 13px;">
        If you didn't request this password reset, please ignore this email. Your password will remain unchanged.
      </p>
    </div>
    <div class="footer">
      <p><strong>FicLance - Freelance Marketplace</strong></p>
      <p>Reference ID: ${referenceId}</p>
      <p style="margin-top: 10px;">© ${new Date().getFullYear()} FicLance. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`.trim();

      const result = await this.resend.emails.send({
        from: `FicLance <${senderEmail}>`,
        to: email,
        subject: 'Reset Your FicLance Password',
        html: htmlContent,
        tags: [
          {
            name: 'category',
            value: 'password-reset',
          },
        ],
      });

      logger.info('✅ Password reset email sent', {
        email,
        referenceId,
        resendId: result.data?.id,
      });

      return {
        success: true,
        emailId: result.data?.id,
        referenceId,
      };
    } catch (error) {
      logger.error('❌ Failed to send password reset email', {
        error: error.message,
        email,
        referenceId,
      });

      return {
        success: false,
        error: error.message,
        referenceId,
      };
    }
  }

  /**
   * Send Newsletter Subscription Notification
   * Notifies admin when someone subscribes to newsletter
   *
   * @param {Object} data - Subscription data
   * @param {string} data.email - Subscriber's email
   * @param {Date} data.subscribedAt - Subscription timestamp
   * @returns {Promise<Object>} Email send result
   */
  async sendNewsletterSubscription(data) {
    if (!this.isConfigured) {
      logger.warn('Email service not configured. Skipping newsletter notification.');
      return { success: false, reason: 'Email service not configured' };
    }

    const referenceId = this.generateReferenceId('newsletter');
    const timestamp = new Date(data.subscribedAt).toLocaleString('en-US', {
      dateStyle: 'full',
      timeStyle: 'long',
    });

    try {
      const senderEmail = process.env.SUPPORT_SENDER_EMAIL || 'onboarding@resend.dev';

      const result = await this.resend.emails.send({
        from: `FicLance Newsletter <${senderEmail}>`,
        to: this.supportReceiverEmail,
        subject: `🎉 New Newsletter Subscription - ${data.email}`,
        html: this._generateNewsletterSubscriptionHtml({
          email: data.email,
          timestamp,
          referenceId,
        }),
        tags: [
          {
            name: 'category',
            value: 'newsletter-subscription',
          },
        ],
      });

      logger.info('✅ Newsletter subscription notification sent successfully', {
        email: data.email,
        referenceId,
        resendId: result.data?.id,
      });

      return {
        success: true,
        referenceId,
        resendId: result.data?.id,
      };
    } catch (error) {
      logger.error('❌ Failed to send newsletter subscription notification', {
        error: error.message,
        email: data.email,
        referenceId,
      });

      return {
        success: false,
        error: error.message,
        referenceId,
      };
    }
  }

  /**
   * Generate HTML for newsletter subscription notification
   * @private
   */
  _generateNewsletterSubscriptionHtml({ email, timestamp, referenceId }) {
    const escapedEmail = this._escapeHtml(email);

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Newsletter Subscription</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #FF8C22 0%, #673AB7 100%); padding: 40px; text-align: center;">
                      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">🎉 New Newsletter Subscriber!</h1>
                    </td>
                  </tr>

                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px;">
                      <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                        Great news! Someone just subscribed to your FicLance newsletter.
                      </p>

                      <!-- Subscriber Info Box -->
                      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8f9fa; border-radius: 8px; margin-bottom: 24px;">
                        <tr>
                          <td style="padding: 24px;">
                            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                              <tr>
                                <td style="padding: 8px 0;">
                                  <strong style="color: #555555; font-size: 14px;">Email Address:</strong>
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0;">
                                  <span style="color: #FF8C22; font-size: 16px; font-weight: 600;">${escapedEmail}</span>
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0; padding-top: 16px;">
                                  <strong style="color: #555555; font-size: 14px;">Subscribed At:</strong>
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0;">
                                  <span style="color: #333333; font-size: 14px;">${this._escapeHtml(timestamp)}</span>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>

                      <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 24px 0 0;">
                        Add this email to your newsletter distribution list to keep them updated with the latest news, features, and content.
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f8f9fa; padding: 24px; text-align: center; border-top: 1px solid #e9ecef;">
                      <p style="color: #999999; font-size: 12px; margin: 0 0 8px;">Reference ID: ${this._escapeHtml(referenceId)}</p>
                      <p style="color: #999999; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} FicLance. All rights reserved.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;
  }
}

// Export singleton instance
module.exports = new EmailService();
