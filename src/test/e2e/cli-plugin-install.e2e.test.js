const fs = require("node:fs");
const path = require("node:path");
const util = require("node:util");

const should = require("should");
const cpr = require("cpr");
const rimraf = require("rimraf");
const tmp = require("tmp");
const yaml = require("js-yaml");

const PACKAGE_NAME = "express-gateway-plugin-test";

const gatewayDirectory = path.join(__dirname, "../../../src/core/config");
const pluginDirectory = path.join(__dirname, "../fixtures", PACKAGE_NAME);
const { runCLICommand } = require("../common/cli.helper");

let tempPath = null;

const config = {
  systemConfigPath: null,
  gatewayConfigPath: null,
};

describe("E2E: eg plugins install", () => {
  beforeAll(async () => {
    return util
      .promisify(tmp.dir)()
      .then((temp) => {
        tempPath = temp;
        const _cpr = util.promisify(cpr);
        return _cpr(gatewayDirectory, tempPath);
      })
      .then(() => {
        config.systemConfigPath = path.join(tempPath, "system.config.yml");
        config.gatewayConfigPath = path.join(tempPath, "gateway.config.yml");

        return runCLICommand({
          cliArgs: [
            "plugins",
            "install",
            pluginDirectory,
            "-n",
            "-g",
            "-o",
            '"foo=bar"',
            "-o",
            '"baz=4444"',
          ],
          adminPort: 0,
          configDirectoryPath: tempPath,
          cliExecOptions: { cwd: tempPath },
        });
      });
  });

  afterAll(async () => {
    await new Promise((resolve, reject) => {
      rimraf(tempPath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });

  test("installs a plugin with a directory package specifier", () => {
    const systemConfigData = fs.readFileSync(config.systemConfigPath);
    const systemConfig = yaml.load(systemConfigData.toString());

    const expected = {
      test: {
        package: "express-gateway-plugin-test",
        foo: "bar",
        baz: "4444",
      },
    };

    should(systemConfig.plugins).be.deepEqual(expected);
  });
});
