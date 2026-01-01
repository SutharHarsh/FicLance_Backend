const crypto = require("crypto");
const bcrypt = require("bcrypt");
const config = require("../config/env");

class CryptoUtil {
  /**
   * Hash password using bcrypt
   * @param {String} password - Plain text password
   * @returns {Promise<String>} Hashed password
   */
  async hashPassword(password) {
    return await bcrypt.hash(password, config.security.bcryptRounds);
  }

  /**
   * Compare password with hash
   * @param {String} password - Plain text password
   * @param {String} hash - Hashed password
   * @returns {Promise<Boolean>} Match result
   */
  async comparePassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }

  /**
   * Hash refresh token using HMAC-SHA256
   * @param {String} token - Plain refresh token
   * @returns {String} Hashed token
   */
  hashRefreshToken = (token) => {
    return crypto
      .createHmac("sha256", config.jwt.refreshSecret)
      .update(token)
      .digest("hex");
  };

  /**
   * Hash token (alias for hashRefreshToken)
   * @param {String} token - Plain token
   * @returns {String} Hashed token
   */
  hashToken = (token) => {
    return this.hashRefreshToken(token);
  };

  /**
   * Generate random token for password reset, email verification, etc.
   * @param {Number} length - Token length in bytes (default 32)
   * @returns {String} Random hex string
   */
  generateRandomToken(length = 32) {
    return crypto.randomBytes(length).toString("hex");
  }

  /**
   * Hash generic string using SHA256
   * @param {String} str - String to hash
   * @returns {String} Hash
   */
  hashString = (str) => {
    return crypto.createHash("sha256").update(str).digest("hex");
  };

  /**
   * Generate idempotency key from multiple values
   * @param {...String} values - Values to hash
   * @returns {String} Idempotency hash
   */
  generateIdempotencyKey(...values) {
    const combined = values.join("::");
    return this.hashString(combined);
  }

  /**
   * Encrypt sensitive data using AES-256-GCM
   * @param {String} text - Text to encrypt
   * @param {String} key - Encryption key (default: JWT refresh secret)
   * @returns {String} Encrypted data with IV prepended
   */
  encrypt(text, key = config.jwt.refreshSecret) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      "aes-256-gcm",
      crypto.scryptSync(key, "salt", 32),
      iv
    );

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");

    // Return IV:AuthTag:EncryptedData
    return `${iv.toString("hex")}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypt data encrypted with encrypt()
   * @param {String} encrypted - Encrypted data with IV and auth tag
   * @param {String} key - Decryption key
   * @returns {String} Decrypted text
   */
  decrypt(encrypted, key = config.jwt.refreshSecret) {
    const [ivHex, authTagHex, encryptedData] = encrypted.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      crypto.scryptSync(key, "salt", 32),
      iv
    );

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }
}

module.exports = new CryptoUtil();
