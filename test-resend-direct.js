// Test Resend API directly to see response structure
require('dotenv').config();
const { Resend } = require('resend');

async function testResendDirect() {
  const resend = new Resend(process.env.RESEND_API_KEY);
  
  console.log('🔍 Testing Resend API directly...\n');
  
  try {
    const result = await resend.emails.send({
      from: 'Test User <test@example.com>',
      to: process.env.SUPPORT_RECEIVER_EMAIL,
      reply_to: 'test@example.com',
      subject: '[Test] Direct Resend API Test',
      html: '<h1>Test Email</h1><p>This is a direct test of the Resend API.</p>',
    });
    
    console.log('✅ Email sent!');
    console.log('\nFull Response:');
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('❌ Error:');
    console.error('Message:', error.message);
    console.error('\nFull Error:');
    console.error(JSON.stringify(error, null, 2));
  }
}

testResendDirect();
