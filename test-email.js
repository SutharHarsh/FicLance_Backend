// Quick test script to verify Resend email configuration
require('dotenv').config();
const emailService = require('./src/services/email.service');

async function testEmail() {
  console.log('🔍 Testing Resend Email Service...\n');
  
  // Check configuration
  console.log('Configuration:');
  console.log('  RESEND_API_KEY:', process.env.RESEND_API_KEY ? '✅ Set' : '❌ Missing');
  console.log('  SUPPORT_RECEIVER_EMAIL:', process.env.SUPPORT_RECEIVER_EMAIL || '❌ Missing');
  console.log('  SUPPORT_SENDER_EMAIL:', process.env.SUPPORT_SENDER_EMAIL || 'Default');
  console.log('  Service Configured:', emailService.isConfigured ? '✅ Yes' : '❌ No');
  console.log('');
  
  if (!emailService.isConfigured) {
    console.error('❌ Email service is not configured properly!');
    process.exit(1);
  }
  
  // Test support ticket email
  console.log('📧 Sending test support ticket email...\n');
  
  const testTicket = {
    id: 'TEST-' + Date.now(),
    user: {
      name: 'Test User',
      email: 'test@example.com',
    },
    subject: 'Test Email from FicLance',
    category: 'Technical',
    description: 'This is a test email to verify the Resend integration is working correctly.',
    createdAt: new Date(),
  };
  
  try {
    const result = await emailService.sendSupportTicketEmail(testTicket);
    
    if (result.success) {
      console.log('✅ Email sent successfully!');
      console.log('   Email ID:', result.emailId);
      console.log('   Reference ID:', result.referenceId);
      console.log('\n📬 Check your inbox at:', process.env.SUPPORT_RECEIVER_EMAIL);
    } else {
      console.error('❌ Email failed to send:');
      console.error('   Reason:', result.reason || result.error);
    }
  } catch (error) {
    console.error('❌ Error sending email:');
    console.error('   Message:', error.message);
    console.error('   Stack:', error.stack);
  }
}

testEmail();
