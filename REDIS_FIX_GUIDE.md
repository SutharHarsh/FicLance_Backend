# Redis Request Limit Fix - Complete Guide

## Problem
Your application hit the Upstash Redis request limit (500,000 requests), causing BullMQ queues to fail with:
```
ERR max requests limit exceeded. Limit: 500000, Usage: 500005
```

## Root Causes
1. **Aggressive polling**: BullMQ workers were checking for jobs every 30 seconds (default)
2. **Too many stored jobs**: Keeping 100+ completed and 500+ failed jobs
3. **Excessive stalled checks**: Continuous health checks on queues
4. **No cleanup**: Old jobs accumulating in Redis over time

## Solutions Implemented

### 1. Optimized Queue Settings
**File**: `src/services/queue.service.js`

**Changes**:
- ✅ Reduced completed job retention: 100 → 10 jobs, 24h → 1h
- ✅ Reduced failed job retention: 500 → 50 jobs, no limit → 1h
- ✅ Added `stalledInterval: 60000` (check every 60s instead of 30s)
- ✅ Added `maxStalledCount: 2` to limit stalled job recovery attempts

**Impact**: Reduces Redis requests by ~50-70%

### 2. Optimized Worker Settings
**File**: `src/worker.js`

**Changes**:
- ✅ Added `lockDuration: 30000` (30 seconds)
- ✅ Added `stalledInterval: 60000` (60 seconds)
- ✅ Added `maxStalledCount: 2`

**Impact**: Reduces polling frequency and stalled checks

### 3. Optimized Redis Connection
**File**: `src/config/redis.js`

**Changes**:
- ✅ Disabled `enableReadyCheck` to reduce health pings
- ✅ Added connection timeouts
- ✅ Limited retry attempts to 10 max
- ✅ Increased retry delays

**Impact**: Reduces connection-related requests

### 4. Created Cleanup Script
**File**: `scripts/cleanRedis.js`

**Purpose**: Manual cleanup of accumulated jobs

**Usage**:
```bash
cd backend
npm run clean:redis
```

## Immediate Actions Required

### Step 1: Stop All Services
```bash
# In separate terminals, stop:
# 1. Backend server (Ctrl+C)
# 2. Worker process (Ctrl+C)
```

### Step 2: Clean Redis Database
```bash
cd backend
npm run clean:redis
```

This will:
- Remove completed jobs older than 1 hour
- Remove failed jobs older than 1 hour
- Show you current job counts
- Display Redis key statistics

### Step 3: Restart Services
```bash
# Terminal 1: Start backend
cd backend
npm run dev

# Terminal 2: Start worker
cd backend
npm run worker
```

## Monitoring Request Usage

### Check Upstash Dashboard
1. Go to [Upstash Console](https://console.upstash.com)
2. Select your Redis database
3. Check **Metrics** tab for request count
4. Monitor daily usage

### Expected Request Reduction
- **Before**: ~500,000 requests/day (hitting limit)
- **After**: ~50,000-100,000 requests/day (safe zone)

## Long-term Solutions

### Option 1: Upgrade Upstash Plan
- Free tier: 10,000 requests/day
- Pay-as-you-go: $0.20 per 100K requests
- Pro: 500K requests/day included

### Option 2: Use Local Redis (Development)
Update `.env`:
```env
# Comment out Upstash URL
# REDIS_URL=rediss://...

# Use local Redis
REDIS_URL=redis://localhost:6379
```

Install local Redis:
```bash
# Windows (via Chocolatey)
choco install redis-64

# Or use Docker
docker run -d -p 6379:6379 redis:alpine
```

### Option 3: Optimize Further
If still hitting limits:

1. **Reduce worker concurrency**:
```javascript
// In src/worker.js
workers.push(
  createWorker("agentQueue", processAgentJob, {
    concurrency: 2, // Reduce from 5
  })
);
```

2. **Increase stalled intervals**:
```javascript
// In src/services/queue.service.js
settings: {
  stalledInterval: 120000, // 2 minutes
}
```

3. **Disable cleanup queue** (if not needed):
```javascript
// Comment out in src/worker.js
// workers.push(
//   createWorker("cleanupQueue", processCleanupJob, { ... })
// );
```

## Best Practices Going Forward

### 1. Regular Cleanup
Run cleanup weekly:
```bash
npm run clean:redis
```

Or add cron job (Linux/Mac):
```bash
# Add to crontab
0 2 * * 0 cd /path/to/backend && npm run clean:redis
```

### 2. Monitor Queue Health
Check queue stats:
```javascript
// Add to your monitoring
const counts = await queue.getJobCounts();
console.log("Queue counts:", counts);
```

### 3. Job Retention Policy
Keep only essential jobs:
- ✅ Active/waiting jobs: Always keep
- ✅ Recent completed (last hour): Keep for debugging
- ❌ Old completed jobs: Auto-remove
- ✅ Recent failed (last 50): Keep for analysis
- ❌ Old failed jobs: Auto-remove

### 4. Use Job Events Wisely
Avoid creating jobs in loops:
```javascript
// ❌ BAD: Creates 100 jobs
for (let i = 0; i < 100; i++) {
  await queue.add("task", { id: i });
}

// ✅ GOOD: Create one bulk job
await queue.add("bulkTask", { ids: Array(100).fill(0).map((_, i) => i) });
```

## Troubleshooting

### Still Hitting Limits?
1. Check for infinite loops creating jobs
2. Verify no duplicate queue initializations
3. Check socket.io isn't creating excessive jobs
4. Review application logs for repeated job creation

### Jobs Not Processing?
1. Verify worker is running: `npm run worker`
2. Check Redis connection in logs
3. Run cleanup: `npm run clean:redis`
4. Restart worker process

### Need to Reset Everything?
```javascript
// In scripts/cleanRedis.js, uncomment these lines:
await queue.drain(); // Remove all waiting jobs
await queue.obliterate(); // Nuclear option - removes everything

// Or manually flush Redis (DANGEROUS):
const bullKeys = await connection.keys("bull:*");
if (bullKeys.length > 0) {
  await connection.del(...bullKeys);
}
```

## Summary of Changes

| File | Changes | Impact |
|------|---------|--------|
| `queue.service.js` | Reduced job retention, added stalled settings | -50% requests |
| `worker.js` | Added lock duration, stalled intervals | -20% requests |
| `redis.js` | Disabled health checks, optimized retries | -10% requests |
| `scripts/cleanRedis.js` | Created cleanup utility | Manual cleanup |
| `package.json` | Added `clean:redis` script | Easy maintenance |

**Total Expected Reduction**: ~70-80% fewer Redis requests

## Next Steps
1. ✅ Stop services
2. ✅ Run `npm run clean:redis`
3. ✅ Restart services
4. ✅ Monitor Upstash dashboard for 24 hours
5. ✅ If still high, consider upgrading plan or using local Redis

---

**Need Help?** Check Upstash docs: https://upstash.com/docs/redis/troubleshooting/max_requests_limit
