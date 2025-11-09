const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");

const config = require("../config");

function appendCreatedAt(obj) {
  Object.assign(obj, {
    createdAt: new Date().toString(),
  });
}

function appendUpdatedAt(obj) {
  Object.assign(obj, {
    updatedAt: new Date().toString(),
  });
}

function encrypt(text) {
  if (!text || typeof text !== "string") {
    throw new Error("Invalid input: text must be a non-empty string");
  }

  const { cipherKey } = config.systemConfig.crypto;
  const algorithm = "aes-256-cbc"; // 使用明确的安全算法
  const key = Buffer.from(cipherKey, "hex");
  const iv = crypto.randomBytes(16); // 生成16字节的随机IV

  try {
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    // 返回格式: iv:encrypted_data
    return `${iv.toString("hex")}:${encrypted}`;
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

function decrypt(encryptedData) {
  if (!encryptedData || typeof encryptedData !== "string") {
    throw new Error("Invalid input: encrypted data must be a non-empty string");
  }

  const { cipherKey } = config.systemConfig.crypto;
  const algorithm = "aes-256-cbc";
  const key = Buffer.from(cipherKey, "hex");

  try {
    // 解析格式: iv:encrypted_data
    const parts = encryptedData.split(":");
    if (parts.length !== 2) {
      throw new Error("Invalid encrypted data format");
    }

    const iv = Buffer.from(parts[0], "hex");
    const encrypted = parts[1];

    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

function compareSaltAndHashed(password, hash) {
  return !password || !hash ? null : bcrypt.compare(password, hash);
}

function saltAndHash(password) {
  if (!password || typeof password !== "string") {
    return Promise.reject(new Error("invalid arguments"));
  }

  return bcrypt
    .genSalt(config.systemConfig.crypto.saltRounds)
    .then((salt) => bcrypt.hash(password, salt));
}

module.exports = {
  appendCreatedAt,
  appendUpdatedAt,
  encrypt,
  decrypt,
  compareSaltAndHashed,
  saltAndHash,
};
