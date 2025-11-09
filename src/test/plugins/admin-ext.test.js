const assert = require("node:assert");
const admin = require("../../../core/rest");
const eventBus = require("../../../core/eventBus");
const request = require("supertest");
describe("admin with plugins", () => {
  let adminSrv, adminSrvFromEvent;
  before("fires up a new admin instance", () => {
    eventBus.on("admin-ready", ({ adminServer }) => {
      adminSrvFromEvent = adminServer;
    });
    return admin({
      plugins: {
        adminRoutes: [
          (adminExpressInstance) => {
            adminExpressInstance.all("/test", (_req, res) =>
              res.json({ enabled: true }),
            );
          },
        ],
      },
      config: {
        gatewayConfig: {
          admin: {
            port: 0,
          },
        },
      },
    }).then((srv) => {
      adminSrv = srv;
      return srv;
    });
  });

  it("should add custom route", () => {
    return request(adminSrv)
      .get("/test")
      .then((res) => {
        assert.ok(res.body.enabled);
      });
  });
  it("should fire admin-ready event", () => {
    assert.ok(adminSrvFromEvent);
    assert.strictEqual(adminSrvFromEvent, adminSrv);
  });

  after("close admin srv", () => {
    adminSrv.close();
  });
});
