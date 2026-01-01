const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const { getRedisConnection } = require("../config/redis");
const logger = require("../config/logger");
const config = require("../config/env");
const { verifyAccessToken } = require("../utils/jwt");

let io;

/**
 * Initialize Socket.IO server with Redis adapter
 * @param {import('http').Server} httpServer - HTTP server instance
 * @returns {Server} Socket.IO server instance
 */
function initializeSocketIO(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: config.corsOrigin,
      credentials: true,
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  // Set up Redis adapter for scaling
  const pubClient = getRedisConnection();
  const subClient = pubClient.duplicate();

  io.adapter(createAdapter(pubClient, subClient));

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;

      if (!token) {
        return next(new Error("Authentication token required"));
      }

      const decoded = verifyAccessToken(token);
      socket.userId = decoded.userId;
      socket.user = decoded;

      logger.debug(`Socket authenticated for user: ${socket.userId}`);
      next();
    } catch (error) {
      logger.error("Socket authentication error:", error);
      next(new Error("Authentication failed"));
    }
  });

  // Connection handler
  io.on("connection", (socket) => {
    logger.info(`Socket connected: ${socket.id} (user: ${socket.userId})`);

    // Auto-join user-specific room for direct notifications
    if (socket.userId) {
      const userRoom = `user:${socket.userId}`;
      socket.join(userRoom);
      logger.debug(`Socket ${socket.id} auto-joined room: ${userRoom}`);
    }

    // Join simulation room
    socket.on("join:simulation", (simulationId) => {
      const roomName = `simulation:${simulationId}`;
      socket.join(roomName);
      logger.debug(`Socket ${socket.id} joined room: ${roomName}`);

      socket.emit("joined:simulation", { simulationId });
    });

    // Leave simulation room
    socket.on("leave:simulation", (simulationId) => {
      const roomName = `simulation:${simulationId}`;
      socket.leave(roomName);
      logger.debug(`Socket ${socket.id} left room: ${roomName}`);

      socket.emit("left:simulation", { simulationId });
    });

    // Typing indicators
    socket.on("typing:start", ({ simulationId }) => {
      const roomName = `simulation:${simulationId}`;
      socket.to(roomName).emit("typing:start", {
        userId: socket.userId,
        simulationId,
      });
    });

    socket.on("typing:stop", ({ simulationId }) => {
      const roomName = `simulation:${simulationId}`;
      socket.to(roomName).emit("typing:stop", {
        userId: socket.userId,
        simulationId,
      });
    });

    // Disconnect handler
    socket.on("disconnect", (reason) => {
      logger.info(`Socket disconnected: ${socket.id} (reason: ${reason})`);
    });

    // Error handler
    socket.on("error", (error) => {
      logger.error(`Socket error for ${socket.id}:`, error);
    });
  });

  logger.info("Socket.IO initialized with Redis adapter");

  return io;
}

/**
 * Get Socket.IO server instance
 * @returns {Server} Socket.IO server instance
 */
function getIO() {
  if (!io) {
    throw new Error(
      "Socket.IO not initialized. Call initializeSocketIO first."
    );
  }
  return io;
}

/**
 * Emit event to a specific simulation room
 * @param {string} simulationId - Simulation ID
 * @param {string} event - Event name
 * @param {any} data - Event data
 */
function emitToSimulation(simulationId, event, data) {
  const roomName = `simulation:${simulationId}`;
  if (io) {
    io.to(roomName).emit(event, data);
    logger.debug(`Emitted ${event} to room: ${roomName}`);
  }
}

/**
 * Emit event to a specific user
 * @param {string} userId - User ID
 * @param {string} event - Event name
 * @param {any} data - Event data
 */
function emitToUser(userId, event, data) {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
    logger.debug(`Emitted ${event} to user: ${userId}`);
  }
}

module.exports = {
  initializeSocketIO,
  getIO,
  emitToSimulation,
  emitToUser,
};
