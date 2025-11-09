const db = require("../../db");
const config = require("../../config");

const dao = {};

const authCodeNamespace = "auth-code";

dao.save = (code) => {
  // key for the code hash table
  const redisCodeKey = config.systemConfig.db.redis.namespace
    .concat("-", authCodeNamespace)
    .concat(":", code.id);
  return db.hmset(redisCodeKey, code);
};

dao.find = function (criteria) {
  return db
    .hgetall(
      config.systemConfig.db.redis.namespace
        .concat("-", authCodeNamespace)
        .concat(":", criteria.id),
    )
    .then((code) => {
      if (!code || !code.expiresAt) {
        return null;
      }
      code.expiresAt = parseInt(code.expiresAt, 10);
      if (code.expiresAt <= Date.now()) {
        this.remove(criteria.id);
        return null;
      }

      const isEqual = Object.keys(criteria).every(
        (key) => criteria[key] === code[key],
      );
      return isEqual ? code : null;
    });
};

dao.get = (id) =>
  db.hgetall(
    config.systemConfig.db.redis.namespace
      .concat("-", authCodeNamespace)
      .concat(":", id),
  );

dao.remove = (id) =>
  db.del(
    config.systemConfig.db.redis.namespace
      .concat("-", authCodeNamespace)
      .concat(":", id),
  );

module.exports = dao;
