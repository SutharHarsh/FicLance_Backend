const mongoose = require("mongoose");
const config = require("./env");
const logger = require("./logger");

class Database {
  constructor() {
    this.connection = null;
  }

  async connect() {
    try {
      if (this.connection && mongoose.connection.readyState === 1) {
        return this.connection;
      }

      const options = {
        dbName: config.database.dbName,
        maxPoolSize: 10,
        minPoolSize: 2,
        socketTimeoutMS: 45000,
        serverSelectionTimeoutMS: 5000,
        family: 4, // Use IPv4
      };

      this.connection = await mongoose.connect(config.database.uri, options);

      logger.info("MongoDB connected successfully", {
        host: this.connection.connection.host,
        dbName: this.connection.connection.name,
      });

      // Handle connection events
      mongoose.connection.on("error", (err) => {
        logger.error("MongoDB connection error:", err);
      });

      mongoose.connection.on("disconnected", () => {
        logger.warn("MongoDB disconnected");
      });

      mongoose.connection.on("reconnected", () => {
        logger.info("MongoDB reconnected");
      });

      // Graceful shutdown
      process.on("SIGINT", async () => {
        await this.disconnect();
        process.exit(0);
      });

      return this.connection;
    } catch (error) {
      logger.error("MongoDB connection failed:", error);
      process.exit(1);
    }
  }

  async disconnect() {
    if (this.connection) {
      await mongoose.connection.close();
      logger.info("MongoDB connection closed");
    }
  }

  isConnected() {
    return mongoose.connection.readyState === 1;
  }

  getConnection() {
    return this.connection;
  }
}

const database = new Database();

module.exports = {
  connectDatabase: () => database.connect(),
  disconnectDatabase: () => database.disconnect(),
  database,
};
