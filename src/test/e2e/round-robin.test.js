const should = require("should");
const request = require("superagent");
const fs = require("node:fs");
const path = require("node:path");
const yaml = require("js-yaml");

const cliHelper = require("../common/cli.helper");
const gwHelper = require("../common/gateway.helper");

describe("round-robin load @balancing @proxy", () => {
  let gatewayConfig, gatewayProcess, backendServers, gatewayPort;

  beforeAll(async () => {
    gatewayConfig = yaml.load(
      fs.readFileSync(path.resolve("src/config/gateway.config.yml")),
    );

    return cliHelper
      .bootstrapFolder()
      .then((dirInfo) =>
        gwHelper.startGatewayInstance({
          dirInfo,
          gatewayConfig,
          backendServers: 2,
        }),
      )
      .then((gwInfo) => {
        gatewayProcess = gwInfo.gatewayProcess;
        backendServers = gwInfo.backendServers;
        gatewayPort = gwInfo.gatewayPort;
      });
  });

  afterAll(async () => {
    if (gatewayProcess) {
      gatewayProcess.kill();
    }
    if (backendServers && backendServers.length >= 2) {
      backendServers[0].close(() => backendServers[1].close());
    }
  });

  test("proxies with a round-robin balancer", (done) => {
    const messages = [];

    request
      .get(`http://localhost:${gatewayPort}/round-robin`)
      .end((err, res) => {
        if (err) return done(err);
        should(res.statusCode).be.eql(200);
        messages.push(res.text);

        request
          .get(`http://localhost:${gatewayPort}/round-robin`)
          .end((err, res) => {
            if (err) return done(err);
            should(res.statusCode).be.eql(200);
            messages.push(res.text);

            request
              .get(`http://localhost:${gatewayPort}/round-robin`)
              .end((err, res) => {
                if (err) return done(err);
                should(res.statusCode).be.eql(200);
                messages.push(res.text);
                should(messages[0]).not.eql(messages[1]);
                should(messages[0]).eql(messages[2]);
                done();
              });
          });
      });
  });
});
