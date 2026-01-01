const mongoose = require('mongoose');
const config = require('../src/config/env');
const logger = require('../src/config/logger');

// Import migration files
const migrations = [
  require('./migrations/001-add-analysisRequestHash'),
  require('./migrations/002-backfill-templateSnapshot'),
  require('./migrations/003-add-subscription-fields'),
];

async function runMigrations() {
  try {
    // Connect to database
    await mongoose.connect(config.mongoUri, {
      dbName: config.mongoDb,
    });
    
    logger.info('Connected to database for migrations');

    // Run   each migration
    for (const migration of migrations) {
      logger.info(`Running migration: ${migration.name}`);
      await migration.up();
      logger.info(`Completed migration: ${migration.name}`);
    }

    logger.info('All migrations completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
