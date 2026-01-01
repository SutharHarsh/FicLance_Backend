const nodemailer = require('nodemailer');
const config = require('../config/env');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.emailUser,
        pass: config.emailPass,
      },
    });
  }

  /**
   * Send support ticket email
   * @param {Object} ticketData - Support ticket information
   * @returns {Promise<Object>} Email send result
   */
  async sendSupportTicketEmail(ticketData) {
    const { subject, category, description, userEmail, userName } = ticketData;
    
    const referenceId = `FL-${Math.floor(Math.random() * 90000) + 10000}`;
    
    const mailOptions = {
      from: config.emailUser,
      to: config.emailUser, // Send to yourself
      subject: `[Support Ticket] ${subject} - ${referenceId}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px;
              border-radius: 10px 10px 0 0;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: 700;
            }
            .content {
              background: #f9fafb;
              padding: 30px;
              border: 1px solid #e5e7eb;
              border-top: none;
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
              margin-bottom: 5px;
            }
            .value {
              background: white;
              padding: 12px;
              border-radius: 6px;
              border: 1px solid #e5e7eb;
              font-size: 14px;
            }
            .reference {
              background: #667eea;
              color: white;
              padding: 15px;
              border-radius: 6px;
              text-align: center;
              font-weight: 600;
              margin-top: 20px;
              font-family: 'Courier New', monospace;
            }
            .footer {
              text-align: center;
              padding: 20px;
              color: #6b7280;
              font-size: 12px;
              border-top: 1px solid #e5e7eb;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🎫 New Support Ticket</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">FicLance Help Center</p>
          </div>
          
          <div class="content">
            <div class="field">
              <div class="label">Reference ID</div>
              <div class="reference">${referenceId}</div>
            </div>

            <div class="field">
              <div class="label">Submitted By</div>
              <div class="value">${userEmail || userName || 'Guest User'}</div>
            </div>

            <div class="field">
              <div class="label">Subject</div>
              <div class="value">${subject}</div>
            </div>

            <div class="field">
              <div class="label">Category</div>
              <div class="value">${category}</div>
            </div>

            <div class="field">
              <div class="label">Description</div>
              <div class="value">${description.replace(/\n/g, '<br>')}</div>
            </div>
          </div>

          <div class="footer">
            <p>This is an automated email from FicLance Support System</p>
            <p>© ${new Date().getFullYear()} FicLance. All rights reserved.</p>
          </div>
        </body>
        </html>
      `,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      return {
        success: true,
        messageId: info.messageId,
        referenceId,
      };
    } catch (error) {
      console.error('Error sending support ticket email:', error);
      throw error;
    }
  }

  /**
   * Send password reset email
   * @param {Object} resetData - Password reset information
   * @returns {Promise<Object>} Email send result
   */
  async sendPasswordResetEmail(resetData) {
    const { email, resetToken, userName } = resetData;
    
    // Create reset link with token
    const resetLink = `${config.frontendUrl}/auth/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: config.emailUser,
      to: email,
      subject: 'Reset Your FicLance Password',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f9fafb;
            }
            .container {
              background: white;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 40px 30px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: 700;
            }
            .header p {
              margin: 10px 0 0 0;
              opacity: 0.9;
              font-size: 14px;
            }
            .content {
              padding: 40px 30px;
            }
            .greeting {
              font-size: 16px;
              color: #4b5563;
              margin-bottom: 20px;
            }
            .message {
              font-size: 14px;
              color: #6b7280;
              margin-bottom: 30px;
              line-height: 1.8;
            }
            .button-container {
              text-align: center;
              margin: 30px 0;
            }
            .reset-button {
              display: inline-block;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 16px 40px;
              border-radius: 8px;
              text-decoration: none;
              font-weight: 600;
              font-size: 16px;
              box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);
              transition: all 0.3s ease;
            }
            .reset-button:hover {
              box-shadow: 0 6px 12px rgba(102, 126, 234, 0.4);
              transform: translateY(-2px);
            }
            .divider {
              border-top: 1px solid #e5e7eb;
              margin: 30px 0;
            }
            .alternative {
              font-size: 12px;
              color: #9ca3af;
              text-align: center;
              margin-top: 20px;
            }
            .alternative a {
              color: #667eea;
              text-decoration: none;
              word-break: break-all;
            }
            .warning {
              background: #fef3c7;
              border-left: 4px solid #f59e0b;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
              font-size: 13px;
              color: #92400e;
            }
            .footer {
              text-align: center;
              padding: 30px;
              color: #9ca3af;
              font-size: 12px;
              background: #f9fafb;
              border-top: 1px solid #e5e7eb;
            }
            .footer p {
              margin: 5px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Password Reset Request</h1>
              <p>FicLance Security</p>
            </div>
            
            <div class="content">
              <div class="greeting">
                Hello${userName ? ' ' + userName : ''},
              </div>

              <div class="message">
                We received a request to reset your password for your FicLance account. 
                Click the button below to create a new password. This link will expire in 1 hour for security reasons.
              </div>

              <div class="button-container">
                <a href="${resetLink}" class="reset-button">Reset Password</a>
              </div>

              <div class="divider"></div>

              <div class="alternative">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${resetLink}">${resetLink}</a>
              </div>

              <div class="warning">
                <strong>⚠️ Security Notice:</strong><br>
                If you didn't request this password reset, please ignore this email. 
                Your password will remain unchanged. Someone may have entered your email address by mistake.
              </div>
            </div>

            <div class="footer">
              <p>This is an automated email from FicLance Security System</p>
              <p>© ${new Date().getFullYear()} FicLance. All rights reserved.</p>
              <p style="margin-top: 15px; font-size: 11px; color: #d1d5db;">
                Never share your password reset link with anyone. FicLance will never ask for your password via email.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      console.error('Error sending password reset email:', error);
      throw error;
    }
  }
}

module.exports = new EmailService();
