const { exec } = require("node:child_process");
const path = require("node:path");
const util = require("node:util");
const dir = util.promisify(require("tmp").dir);
const _cpr = util.promisify(require("cpr"));

const modulePath = path.resolve(__dirname, "..", "..", "bin", "index.js");

module.exports.bootstrapFolder = () =>
  dir()
    .then((tempDir) =>
      Promise.all([
        tempDir,
        _cpr(
          path.join(
            __dirname,
            "../../bin/generators/gateway/templates/getting-started/",
          ),
          tempDir,
        ),
        _cpr(
          path.join(__dirname, "../../../src/core/config/models"),
          path.join(tempDir, "config", "models"),
        ),
      ]),
    )
    .then(([tempDir]) => ({
      basePath: tempDir,
      configDirectoryPath: path.join(tempDir, "config"),
      gatewayConfigPath: path.join(tempDir, "config", "gateway.config.yml"),
      systemConfigPath: path.join(tempDir, "config", "system.config.yml"),
    }));

module.exports.runCLICommand = ({
  adminPort,
  adminUrl,
  configDirectoryPath,
  cliArgs,
  cliExecOptions,
}) => {
  // TODO: it should not depend on configFolder, API only, now the last dependency is models
  cliExecOptions = Object.assign(
    {
      env: process.env,
    },
    cliExecOptions || {},
  );

  cliExecOptions.env.EG_CONFIG_DIR = configDirectoryPath;
  cliExecOptions.env.EG_ADMIN_URL = adminUrl || `http://localhost:${adminPort}`;
  const command = ["node", modulePath].concat(cliArgs).join(" ");
  return new Promise((resolve, reject) => {
    exec(command, cliExecOptions, (err, stdout) => {
      if (err) {
        reject(err);
        return;
      }
      try {
        const obj = JSON.parse(stdout);
        resolve(obj);
      } catch (err) {
        if (err instanceof SyntaxError) {
          resolve(stdout);
        } else {
          reject(err);
        }
      }
    });
  });
};
