const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");

let mongoServer;

// Setup before all tests
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
});

// Cleanup after all tests
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// Clear database between tests
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// Mock environment variables for tests
process.env.JWT_ACCESS_TOKEN_SECRET =
  "test_access_secret_key_min_32_chars_long";
process.env.JWT_REFRESH_TOKEN_SECRET =
  "test_refresh_secret_key_min_32_chars_long";
process.env.MONGODB_URI = "mongodb://test";
process.env.REDIS_URL = "https://glad-boxer-56685.upstash.io";
process.env.FRONTEND_URL = "http://localhost:3000";
process.env.CORS_ORIGIN = "http://localhost:3000";
process.env.S3_ENDPOINT = "http://localhost:9000";
process.env.S3_BUCKET = "test-bucket";
process.env.S3_REGION = "us-east-1";
process.env.S3_ACCESS_KEY_ID = "test";
process.env.S3_SECRET_ACCESS_KEY = "test";
process.env.AGENT_SERVICE_URL = "http://localhost:8000";
process.env.ADMIN_USER_IDS = "";
