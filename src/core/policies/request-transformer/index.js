const _jsonParser = require("express").json();
const _urlEncoded = require("express").urlencoded({ extended: true });
const { PassThrough } = require("node:stream");
const _transformObject = require("./transform-object");
const _formurlencoded = require("form-urlencoded").default;

module.exports = {
  schema: require("./schema"),
  policy: (_params) => {
    return (_req, _res, next) => {
      // SECURITY CRITICAL: Request transformer policy disabled due to RCE vulnerability
      const error = new Error(
        "Request transformer policy is DISABLED for security reasons. Arbitrary code execution in transformations is not allowed.",
      );
      error.statusCode = 403;
      next(error);
    };
  },
};
