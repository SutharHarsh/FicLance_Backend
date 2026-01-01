const { S3Client } = require('@aws-sdk/client-s3');
const config = require('./env');
const logger = require('./logger');

class S3Service {
  constructor() {
    this.client = null;
    this.initialize();
  }

  initialize() {
    try {
      const s3Config = {
        region: config.s3.region,
        credentials: {
          accessKeyId: config.s3.accessKeyId,
          secretAccessKey: config.s3.secretAccessKey,
        },
        forcePathStyle: config.s3.forcePathStyle, // Required for MinIO
      };

      // Only set endpoint if not using AWS S3
      if (!config.s3.endpoint.includes('amazonaws.com')) {
        s3Config.endpoint = config.s3.endpoint;
      }

      this.client = new S3Client(s3Config);
      
      logger.info('S3 client initialized', {
        region: config.s3.region,
        bucket: config.s3.bucket,
        endpoint: config.s3.endpoint,
      });
    } catch (error) {
      logger.error('S3 client initialization failed:', error);
      throw error;
    }
  }

  getClient() {
    if (!this.client) {
      throw new Error('S3 client not initialized');
    }
    return this.client;
  }

  getBucket() {
    return config.s3.bucket;
  }

  getRegion() {
    return config.s3.region;
  }
}

module.exports = new S3Service();
