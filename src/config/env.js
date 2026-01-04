const dotenv = require("dotenv");
const Joi = require("joi");

// Load environment variables
dotenv.config();

// Environment validation schema
const envSchema = Joi.object({
  // Application
  NODE_ENV: Joi.string()
    .valid("development", "production", "test")
    .default("development"),
  PORT: Joi.number().default(8080),
  API_V1_PREFIX: Joi.string().default("/api/v1"),

  // Database
  MONGODB_URI: Joi.string().required(),
  MONGODB_DB: Joi.string().default("ficlance"),

  // Redis
  REDIS_URL: Joi.string()
    .uri({ scheme: ["redis", "rediss"] })
    .required(),

  REDIS_PASSWORD: Joi.string().allow("").optional(),

  // S3
  S3_ENDPOINT: Joi.string().required(),
  S3_BUCKET: Joi.string().required(),
  S3_REGION: Joi.string().required(),
  S3_ACCESS_KEY_ID: Joi.string().required(),
  S3_SECRET_ACCESS_KEY: Joi.string().required(),
  S3_FORCE_PATH_STYLE: Joi.boolean().default(false),

  // JWT
  JWT_ACCESS_TOKEN_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_TOKEN_SECRET: Joi.string().min(32).required(),
  ACCESS_TOKEN_TTL: Joi.string().default("15m"),
  REFRESH_TOKEN_TTL: Joi.string().default("30d"),

  // OAuth
  GOOGLE_CLIENT_ID: Joi.string().allow("").optional(),
  GOOGLE_CLIENT_SECRET: Joi.string().allow("").optional(),
  GOOGLE_CALLBACK_URL: Joi.string().allow("").optional(),
  GITHUB_CLIENT_ID: Joi.string().allow("").optional(),
  GITHUB_CLIENT_SECRET: Joi.string().allow("").optional(),
  GITHUB_CALLBACK_URL: Joi.string().allow("").optional(),

  // Frontend
  FRONTEND_URL: Joi.string().uri().required(),

  // Third-party
  SENTRY_DSN: Joi.string().allow("").optional(),
  SMTP_URL: Joi.string().allow("").optional(),

  // AI Agent Service
  AGENT_SERVICE_URL: Joi.string().uri().default("http://127.0.0.1:8000"),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: Joi.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),
  AUTH_RATE_LIMIT_MAX: Joi.number().default(5),

  // Worker
  WORKER_CONCURRENCY: Joi.number().default(5),
  JOB_ATTEMPTS: Joi.number().default(3),
  JOB_BACKOFF_DELAY: Joi.number().default(5000),

  // Logging
  LOG_LEVEL: Joi.string()
    .valid("error", "warn", "info", "debug")
    .default("info"),
  LOG_FILE: Joi.string().default("logs/app.log"),

  // Security
  BCRYPT_ROUNDS: Joi.number().default(12),
  CORS_ORIGIN: Joi.string().default("http://localhost:3000"),
  COOKIE_DOMAIN: Joi.string().default("localhost"),
  COOKIE_SECURE: Joi.boolean().default(false),

  // Beta Mode
  IS_BETA_MODE: Joi.boolean().default(false),

  // Project Limits
  MAX_ACTIVE_PROJECTS: Joi.number().integer().min(1).default(3),

  // Email Configuration (Resend API - Production)
  RESEND_API_KEY: Joi.string().optional(),
  SUPPORT_SENDER_EMAIL: Joi.string().email().optional(),
  SUPPORT_RECEIVER_EMAIL: Joi.string().email().optional(),

  // Feature flags
  ENABLE_WORKERS: Joi.boolean().default(true),
}).unknown(true);

// Validate environment variables
const { error, value: env } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Environment validation error: ${error.message}`);
}

const config = {
  // Application (Nested)
  app: {
    env: env.NODE_ENV,
    port: env.PORT,
    apiPrefix: env.API_V1_PREFIX,
    isProduction: env.NODE_ENV === "production",
    isDevelopment: env.NODE_ENV === "development",
    isTest: env.NODE_ENV === "test",
  },

  // ALIASES for backward compatibility (Flat access)
  env: env.NODE_ENV,
  port: env.PORT,
  apiPrefix: env.API_V1_PREFIX,
  isProduction: env.NODE_ENV === "production",
  isDevelopment: env.NODE_ENV === "development",
  isTest: env.NODE_ENV === "test",

  // Database
  database: {
    uri: env.MONGODB_URI,
    dbName: env.MONGODB_DB,
  },
  mongoUri: env.MONGODB_URI,
  mongoDb: env.MONGODB_DB,

  // Redis
  redis: {
    url: env.REDIS_URL,
    password: env.REDIS_PASSWORD,
  },
  redisUrl: env.REDIS_URL,
  redisPassword: env.REDIS_PASSWORD,

  // S3 / Storage
  s3: {
    endpoint: env.S3_ENDPOINT,
    bucket: env.S3_BUCKET,
    region: env.S3_REGION,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
  },
  s3Endpoint: env.S3_ENDPOINT,
  s3Bucket: env.S3_BUCKET,
  s3Region: env.S3_REGION,
  s3AccessKeyId: env.S3_ACCESS_KEY_ID,
  s3SecretAccessKey: env.S3_SECRET_ACCESS_KEY,

  // JWT
  jwt: {
    accessSecret: env.JWT_ACCESS_TOKEN_SECRET,
    refreshSecret: env.JWT_REFRESH_TOKEN_SECRET,
    accessTTL: env.ACCESS_TOKEN_TTL,
    refreshTTL: env.REFRESH_TOKEN_TTL,
  },
  jwtAccessSecret: env.JWT_ACCESS_TOKEN_SECRET,
  jwtRefreshSecret: env.JWT_REFRESH_TOKEN_SECRET,
  accessTokenTTL: env.ACCESS_TOKEN_TTL,
  refreshTokenTTL: env.REFRESH_TOKEN_TTL,

  // OAuth
  oauth: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: env.GOOGLE_CALLBACK_URL,
    },
    github: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
      callbackURL: env.GITHUB_CALLBACK_URL,
    },
  },
  googleClientId: env.GOOGLE_CLIENT_ID,
  googleClientSecret: env.GOOGLE_CLIENT_SECRET,
  googleCallbackURL: env.GOOGLE_CALLBACK_URL,
  githubClientId: env.GITHUB_CLIENT_ID,
  githubClientSecret: env.GITHUB_CLIENT_SECRET,
  githubCallbackURL: env.GITHUB_CALLBACK_URL,

  // Frontend
  frontend: {
    url: env.FRONTEND_URL,
    corsOrigin: env.CORS_ORIGIN,
  },
  frontendUrl: env.FRONTEND_URL,
  corsOrigin: env.CORS_ORIGIN,

  // Services
  services: {
    agentServiceUrl: env.AGENT_SERVICE_URL,
    sentryDsn: env.SENTRY_DSN,
    smtpUrl: env.SMTP_URL,
  },
  agentServiceUrl: env.AGENT_SERVICE_URL,

  // Rate Limiting
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
    authMax: env.AUTH_RATE_LIMIT_MAX,
  },
  rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
  rateLimitMaxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  authRateLimitMax: env.AUTH_RATE_LIMIT_MAX,

  // Worker
  worker: {
    concurrency: env.WORKER_CONCURRENCY,
    attempts: env.JOB_ATTEMPTS,
    backoffDelay: env.JOB_BACKOFF_DELAY,
  },

  // Logging
  logging: {
    level: env.LOG_LEVEL,
    file: env.LOG_FILE,
  },
  logLevel: env.LOG_LEVEL,
  logFile: env.LOG_FILE,

  // Security
  security: {
    bcryptRounds: env.BCRYPT_ROUNDS,
    cookieDomain: env.COOKIE_DOMAIN,
    cookieSecure: env.COOKIE_SECURE,
  },
  bcryptRounds: env.BCRYPT_ROUNDS,
  cookieDomain: env.COOKIE_DOMAIN,
  cookieSecure: env.COOKIE_SECURE,

  // Beta Mode
  isBetaMode: env.IS_BETA_MODE,

  // Project Limits
  maxActiveProjects: env.MAX_ACTIVE_PROJECTS,

  // Email Configuration (Resend API)
  resendApiKey: env.RESEND_API_KEY,
  supportSenderEmail: env.SUPPORT_SENDER_EMAIL,
  supportReceiverEmail: env.SUPPORT_RECEIVER_EMAIL,

  // Feature flags
  enableWorkers: env.ENABLE_WORKERS,
};

module.exports = config;
