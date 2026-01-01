const { User } = require('../../src/models');
const logger = require('../../src/config/logger');

module.exports = {
  name: 'add-subscription-fields',

  async up() {
    logger.info('Adding subscription fields to existing users...');

    const users = await User.find({
      subscription: { $exists: false },
    });

    let updated = 0;

    for (const user of users) {
      user.subscription = {
        plan: 'free',
        status: 'inactive',
      };
      user.paymentHistory = [];
      
      await user.save();
      updated++;
    }

    logger.info(`Updated ${updated} users with subscription fields`);

    // Create index on Stripe customer ID
    await User.collection.createIndex(
      { 'subscription.stripeCustomerId': 1 },
      { unique: true, sparse: true }
    );
    
    logger.info('Created index on subscription.stripeCustomerId');
  },
};
