try {
  console.log('Testing config loading...');
  const config = require('./src/config/env');
  console.log('Config loaded successfully.');
  console.log('Logging config:', JSON.stringify(config.logging, null, 2));
  
  console.log('Testing logger loading...');
  const logger = require('./src/config/logger');
  console.log('Logger loaded successfully.');
  
  logger.info('Test log message');
  console.log('Test completed successfully.');
} catch (error) {
  console.error('DIAGNOSTIC FAILED:');
  console.error(error);
  process.exit(1);
}
