const yaml = require("js-yaml");
const fs = require("node:fs");
const { fork } = require("node:child_process");
const path = require("node:path");
const request = require("superagent");
const util = require("node:util");
const _cpr = util.promisify(require("cpr"));
const {
  generateBackendServer,
  findOpenPortNumbers,
} = require("../common/server-helper");
let gatewayPort = null;
let adminPort = null;
let backendPorts = null;

// Set gateway.config or system.config yml files
module.exports.setYmlConfig = ({ ymlConfigPath, newConfig }) => {
  fs.writeFileSync(ymlConfigPath, yaml.dump(newConfig));
};

// Get config by path (gateway.config.yml or system.config.yml)
module.exports.getYmlConfig = ({ ymlConfigPath }) => {
  const content = fs.readFileSync();
  return yaml.load(content);
};

module.exports.startGatewayInstance = function ({
  dirInfo,
  gatewayConfig,
  backendServers = 1,
}) {
  console.log("Starting gateway instance with config:", gatewayConfig);
  return findOpenPortNumbers(2 + backendServers)
    .then((ports) => {
      gatewayPort = ports.shift();
      adminPort = ports.shift();
      backendPorts = ports;
      console.log(
        `Using ports - Gateway: ${gatewayPort}, Admin: ${adminPort}, Backends: ${backendPorts}`,
      );

      gatewayConfig.http = { port: gatewayPort };
      gatewayConfig.admin = { port: adminPort };
      gatewayConfig.serviceEndpoints = gatewayConfig.serviceEndpoints || {};
      gatewayConfig.serviceEndpoints.backend = {
        urls: backendPorts.map(
          (backendPort) => `http://localhost:${backendPort}`,
        ),
      };

      return this.setYmlConfig({
        ymlConfigPath: dirInfo.gatewayConfigPath,
        newConfig: gatewayConfig,
      });
    })
    .then(() =>
      _cpr(
        path.join(__dirname, "../../../src/core/config/models"),
        path.join(dirInfo.configDirectoryPath, "models"),
        { overwrite: true },
      ),
    )
    .then(() =>
      Promise.all(
        backendPorts.map((backendPort) => generateBackendServer(backendPort)),
      ),
    )
    .then((backendServers) => {
      return new Promise((resolve, reject) => {
        const childEnv = Object.assign({}, process.env);
        childEnv.EG_CONFIG_DIR = dirInfo.configDirectoryPath;
        // Tests, by default have config watch disabled.
        // Need to remove this paramter in the child process.
        delete childEnv.EG_DISABLE_CONFIG_WATCH;

        // Ensure security environment variables are passed
        childEnv.EG_CRYPTO_CIPHER_KEY =
          childEnv.EG_CRYPTO_CIPHER_KEY ||
          "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        childEnv.EG_SESSION_SECRET =
          childEnv.EG_SESSION_SECRET ||
          "test-session-secret-for-jest-testing-only-64-chars-1234567890123456789012345678901234567890123456789012345678901234";

        const modulePath = path.join(
          __dirname,
          "..",
          "..",
          "..",
          "src",
          "index.js",
        );
        console.log("__dirname:", __dirname);
        console.log("Calculated modulePath:", modulePath);
        console.log(
          "Module exists:",
          require("node:fs").existsSync(modulePath),
        );
        const gatewayProcess = fork(modulePath, [], {
          cwd: dirInfo.basePath,
          env: childEnv,
          stdio: "pipe",
        });

        const startupTimeout = setTimeout(() => {
          console.error("Gateway startup timeout after 30 seconds");
          gatewayProcess.kill();
          reject(new Error("Gateway startup timeout"));
        }, 30000);

        gatewayProcess.on("error", (err) => {
          console.error("Gateway process error:", err);
          clearTimeout(startupTimeout);
          reject(err);
        });

        gatewayProcess.on("exit", (code, signal) => {
          console.log(
            `Gateway process exited with code ${code}, signal ${signal}`,
          );
          clearTimeout(startupTimeout);
        });

        // GitHub Best Practice: Implement retry-based health check instead of fixed delay
        const waitForGatewayReady = (retries = 0, maxRetries = 30) => {
          if (retries >= maxRetries) {
            clearTimeout(startupTimeout);
            console.error(
              `Gateway failed to start after ${maxRetries} attempts`,
            );
            gatewayProcess.kill();
            reject(
              new Error(`Gateway failed to start after ${maxRetries} retries`),
            );
            return;
          }

          console.log(`Health check attempt ${retries + 1}/${maxRetries}...`);
          request
            .get(`http://localhost:${gatewayPort}/not-found`)
            .ok((_res) => true)
            .timeout(2000)
            .end((err, _res) => {
              if (err) {
                // Gateway not ready yet, retry after 1 second
                console.log(
                  `Gateway not ready yet (attempt ${retries + 1}), retrying...`,
                );
                setTimeout(
                  () => waitForGatewayReady(retries + 1, maxRetries),
                  1000,
                );
              } else {
                // Gateway is ready!
                clearTimeout(startupTimeout);
                console.log(`✅ Gateway ready after ${retries + 1} attempts`);
                resolve({
                  gatewayProcess,
                  gatewayPort,
                  adminPort,
                  backendPorts,
                  dirInfo,
                  backendServers: backendServers.map((bs) => bs.app),
                });
              }
            });
        };

        // Start health check immediately (GitHub Best Practice: no artificial delays)
        setTimeout(() => waitForGatewayReady(), 500);

        // Still listen to stdout for debugging
        gatewayProcess.stdout.on("data", (data) => {
          console.log("Gateway stdout:", data.toString().trim());
        });

        gatewayProcess.stderr.on("data", (data) => {
          console.error("Gateway stderr:", data.toString());
        });
      });
    });
};
