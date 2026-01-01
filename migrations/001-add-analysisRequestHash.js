const crypto = require('crypto');
const { Portfolio } = require('../../src/models');
const logger = require('../../src/config/logger');

module.exports = {
  name: 'add-analysisRequestHash',

  async up() {
    logger.info('Adding analysisRequestHash to existing portfolios...');

    const portfolios = await Portfolio.find({
      analysisRequestHash: { $exists: false },
    });

    let updated = 0;

    for (const portfolio of portfolios) {
      const hash = crypto
        .createHash('sha256')
        .update(`${portfolio.normalizedRepo}::${portfolio.branch}::${portfolio.userId}`)
        .digest('hex');

      portfolio.analysisRequestHash = hash;
      await portfolio.save();
      updated++;
    }

    logger.info(`Updated ${updated} portfolios with analysisRequestHash`);

    // Create index
    await Portfolio.collection.createIndex({ analysisRequestHash: 1 }, { unique: true, sparse: true });
    
    logger.info('Created index on analysisRequestHash');
  },
};
