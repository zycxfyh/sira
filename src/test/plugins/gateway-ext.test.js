const assert = require("node:assert");
const gateway = require("../../../core/gateway");
const eventBus = require("../../../core/eventBus");
const Config = require("../../../core/config/config");
const request = require("supertest");

const config = new Config();
config.loadGatewayConfig();

describe("gateway routing with plugins", () => {
  let gatewaySrv, httpSrvFromEvent;
  before("fires up a new gateway instance", () => {
    eventBus.on("http-ready", ({ httpServer }) => {
      httpSrvFromEvent = httpServer;
    });
    return gateway({
      plugins: {
        gatewayRoutes: [
          (gatewayExpressInstance) => {
            gatewayExpressInstance.all("/test", (_req, res) =>
              res.json({ enabled: true }),
            );
          },
        ],
      },
      config,
    }).then((srv) => {
      gatewaySrv = srv.app;
      return srv;
    });
  });

  it("should add custom route", () => {
    return request(gatewaySrv)
      .get("/test")
      .then((res) => {
        assert.ok(res.body.enabled);
      });
  });
  it("should fire http-ready event", () => {
    assert.ok(httpSrvFromEvent);
    assert.strictEqual(httpSrvFromEvent, gatewaySrv);
  });

  after("close gateway srv", () => {
    gatewaySrv.close();
  });
});
