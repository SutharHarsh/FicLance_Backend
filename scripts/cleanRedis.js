require("dotenv").config();
const { Queue } = require("bullmq");
const Redis = require("ioredis");
const config = require("../src/config/env");

/**
 * Clean up Redis and remove old/stalled BullMQ jobs
 * This helps reduce request count on Upstash
 */
async function cleanRedis() {
  console.log("🧹 Starting Redis cleanup...");

  const connection = new Redis(config.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    tls: config.redisUrl.startsWith("rediss://") ? {} : undefined,
  });

  const queueNames = ["agentQueue", "repoAnalysisQueue", "cleanupQueue"];

  try {
    for (const queueName of queueNames) {
      console.log(`\n📦 Cleaning queue: ${queueName}`);
      const queue = new Queue(queueName, { connection });

      // Get current counts
      const counts = await queue.getJobCounts();
      console.log(`   Current counts:`, counts);

      // Clean completed jobs older than 1 hour
      const completedCleaned = await queue.clean(3600 * 1000, 100, "completed");
      console.log(`   ✅ Cleaned ${completedCleaned.length} completed jobs (older than 1 hour)`);

      // Clean failed jobs older than 1 hour
      const failedCleaned = await queue.clean(3600 * 1000, 100, "failed");
      console.log(`   ❌ Cleaned ${failedCleaned.length} failed jobs (older than 1 hour)`);

      // AGGRESSIVE CLEANUP: Keep only last 10 completed jobs
      const recentCompletedCleaned = await queue.clean(0, 10, "completed");
      console.log(`   🗑️  Cleaned ${recentCompletedCleaned.length} old completed jobs (keeping only 10 most recent)`);

      // AGGRESSIVE CLEANUP: Keep only last 20 failed jobs for debugging
      const recentFailedCleaned = await queue.clean(0, 20, "failed");
      console.log(`   🗑️  Cleaned ${recentFailedCleaned.length} old failed jobs (keeping only 20 most recent)`);

      // Clean waiting jobs (optional - be careful!)
      // const waitingCleaned = await queue.clean(0, 0, "wait");
      // console.log(`   ⏳ Cleaned ${waitingCleaned.length} waiting jobs`);

      // Drain queue (removes all waiting jobs)
      // await queue.drain();
      // console.log(`   🚽 Drained all waiting jobs`);

      // Close queue
      await queue.close();
    }

    // Get all keys and show stats
    console.log("\n📊 Redis Statistics:");
    const allKeys = await connection.keys("bull:*");
    console.log(`   Total BullMQ keys: ${allKeys.length}`);

    // Show key breakdown
    const keyTypes = {};
    for (const key of allKeys) {
      const type = key.split(":")[2] || "other";
      keyTypes[type] = (keyTypes[type] || 0) + 1;
    }
    console.log("   Key types:", keyTypes);

    // Optional: Flush all BullMQ keys (DANGEROUS!)
    // console.log("\n🗑️  Flushing all BullMQ keys...");
    // const bullKeys = await connection.keys("bull:*");
    // if (bullKeys.length > 0) {
    //   await connection.del(...bullKeys);
    //   console.log(`   Deleted ${bullKeys.length} keys`);
    // }

    console.log("\n✨ Cleanup complete!");
  } catch (error) {
    console.error("❌ Cleanup failed:", error);
  } finally {
    await connection.quit();
    process.exit(0);
  }
}

// Run cleanup
cleanRedis();
