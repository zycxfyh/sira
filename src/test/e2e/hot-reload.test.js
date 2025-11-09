const { fork } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const should = require("should");
const chokidar = require("chokidar");
const cpr = require("cpr");
const request = require("superagent");
const rimraf = require("rimraf");
const tmp = require("tmp");
const yaml = require("js-yaml");

const { findOpenPortNumbers } = require("../common/server-helper");

const GATEWAY_STARTUP_WAIT_TIME = 5000;
const TEST_TIMEOUT = 10000;

const baseConfigDirectory = path.join(__dirname, "../../../src/core/config");

describe("hot-reload", () => {
  describe("gateway config", () => {
    let testGatewayConfigPath = null;
    let testGatewayConfigData = null;
    let childProcess = null;
    let originalGatewayPort = null;
    let watcher = null;

    beforeAll(async () => {
      return new Promise((resolve, reject) => {
        tmp.dir((err, tempPath) => {
          if (err) {
            return reject(err);
          }

          cpr(
            baseConfigDirectory,
            tempPath,
            { filter: (file) => file.includes(".yml") },
            (err, _files) => {
              if (err) {
                return reject(err);
              }

              cpr(
                path.join(__dirname, "../../../src/core/config/models"),
                path.join(tempPath, "models"),
                (err, _files) => {
                  if (err) {
                    return reject(err);
                  }

                  testGatewayConfigPath = path.join(
                    tempPath,
                    "gateway.config.yml",
                  );

                  findOpenPortNumbers(2)
                    .then(([httpPort, adminPort]) => {
                      fs.readFile(testGatewayConfigPath, (err, configData) => {
                        if (err) {
                          return reject(err);
                        }

                        testGatewayConfigData = yaml.load(configData);

                        testGatewayConfigData.http.port = httpPort;
                        testGatewayConfigData.admin.port = adminPort;
                        testGatewayConfigData.serviceEndpoints.backend.url = `http://localhost:${adminPort}`;

                        originalGatewayPort = httpPort;

                        fs.writeFile(
                          testGatewayConfigPath,
                          yaml.dump(testGatewayConfigData),
                          (err) => {
                            if (err) {
                              return reject(err);
                            }

                            const childEnv = Object.assign({}, process.env);
                            childEnv.EG_CONFIG_DIR = tempPath;

                            // Tests, by default have config watch disabled.
                            // Need to remove this paramter in the child process.
                            delete childEnv.EG_DISABLE_CONFIG_WATCH;

                            const modulePath = path.join(
                              __dirname,
                              "../..",
                              "src",
                              "index.js",
                            );
                            childProcess = fork(modulePath, [], {
                              cwd: tempPath,
                              env: childEnv,
                            });

                            childProcess.on("error", reject);

                            // Not ideal, but we need to make sure the process is running.
                            setTimeout(() => {
                              request
                                .get(`http://localhost:${originalGatewayPort}`)
                                .end((err, res) => {
                                  try {
                                    should(err).not.be.undefined();
                                    should(res.unauthorized).not.be.undefined();
                                    resolve();
                                  } catch (e) {
                                    reject(e);
                                  }
                                });
                            }, GATEWAY_STARTUP_WAIT_TIME);
                          },
                        );
                      });
                    })
                    .catch(reject);
                },
              );
            },
          );
        });
      });
    }, TEST_TIMEOUT);

    afterAll(async () => {
      if (childProcess) {
        childProcess.kill();
      }
      await new Promise((resolve, reject) => {
        rimraf(testGatewayConfigPath, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });

    beforeEach(async () => {
      watcher = chokidar.watch(testGatewayConfigPath, {
        awaitWriteFinish: true,
        ignoreInitial: true,
      });
      return new Promise((resolve) => {
        watcher.on("ready", resolve);
      });
    });

    afterEach(() => {
      if (watcher) {
        watcher.close();
        watcher = null;
      }
    });

    describe("reloads valid gateway.config.yml", () => {
      test(
        "will respond with a 404 - proxy policy",
        async () => {
          return new Promise((resolve, reject) => {
            watcher.once("change", (_evt) => {
              setTimeout(() => {
                request
                  .get(`http://localhost:${originalGatewayPort}`)
                  .end((err, res) => {
                    try {
                      should(err).not.be.undefined();
                      should(res.clientError).not.be.undefined();
                      should(res.statusCode).be.eql(404);
                      resolve();
                    } catch (e) {
                      reject(e);
                    }
                  });
              }, GATEWAY_STARTUP_WAIT_TIME);
            });

            testGatewayConfigData.pipelines.adminAPI.policies.shift();
            fs.writeFileSync(
              testGatewayConfigPath,
              yaml.dump(testGatewayConfigData),
            );
          });
        },
        TEST_TIMEOUT,
      );
    });

    describe("uses previous config on reload of invalid gateway.config.yml", () => {
      test(
        "will respond with 404 - empty proxy",
        async () => {
          return new Promise((resolve, reject) => {
            watcher.once("change", () => {
              request
                .get(`http://localhost:${originalGatewayPort}`)
                .end((err, res) => {
                  try {
                    should(err).not.be.undefined();
                    should(res.clientError).not.be.undefined();
                    should(res.statusCode).be.eql(404);
                    resolve();
                  } catch (e) {
                    reject(e);
                  }
                });
            });

            fs.writeFileSync(testGatewayConfigPath, "{er:t4");
          });
        },
        TEST_TIMEOUT,
      );
    });

    describe("adds the required policies in when required gateway.config.yml", () => {
      test(
        "will respond with a 401 - basic-auth policy",
        async () => {
          return new Promise((resolve, reject) => {
            watcher.once("change", (_evt) => {
              setTimeout(() => {
                request
                  .get(`http://localhost:${originalGatewayPort}`)
                  .end((err, res) => {
                    try {
                      should(err).not.be.undefined();
                      should(res.clientError).not.be.undefined();
                      should(res.statusCode).be.eql(401);
                      resolve();
                    } catch (e) {
                      reject(e);
                    }
                  });
              }, GATEWAY_STARTUP_WAIT_TIME);
            });

            testGatewayConfigData.policies.push("basic-auth");
            testGatewayConfigData.pipelines.adminAPI.policies.unshift({
              "basic-auth": {},
            });
            fs.writeFileSync(
              testGatewayConfigPath,
              yaml.dump(testGatewayConfigData),
            );
          });
        },
        TEST_TIMEOUT,
      );
    });
  });
});
