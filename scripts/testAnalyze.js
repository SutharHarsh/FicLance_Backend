// Quick test script to validate idempotent analyzeRepository under concurrency
const mongoose = require('mongoose');
const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const config = require('../src/config/env');
const { analyzeRepository } = require('../src/services/portfolio.service');
const { connectRedis, disconnectRedis } = require('../src/config/redis');

(async () => {
  try {
    await connectDatabase();
    connectRedis();

    const userId = new mongoose.Types.ObjectId();
    const repoUrl = 'https://github.com/vercel/next.js';
    const branch = 'main';

    console.log('[Test] Starting concurrent analyze requests...');
    const [res1, res2] = await Promise.all([
      analyzeRepository(userId, repoUrl, branch),
      analyzeRepository(userId, repoUrl, branch),
    ]);

    console.log('[Test] Response 1:', {
      id: res1._id?.toString?.() || res1._id,
      status: res1.status,
    });
    console.log('[Test] Response 2:', {
      id: res2._id?.toString?.() || res2._id,
      status: res2.status,
    });

    console.log('[Test] Done. If statuses are queued/running/done and same id, idempotency works.');
  } catch (err) {
    console.error('[Test] Error:', err);
  } finally {
    await disconnectDatabase();
    await disconnectRedis();
    process.exit(0);
  }
})();
