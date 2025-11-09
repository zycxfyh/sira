const should = require("should");
const gateway = require("../../../core/gateway");
const Config = require("../../../core/config/config");
const testHelper = require("../common/routing.helper");

const config = new Config();
config.gatewayConfig = {
  http: {
    port: 0,
  },
  apiEndpoints: {
    test_default: {
      host: "*",
      paths: ["/*"],
    },
  },
  policies: ["test-policy"],
  pipelines: {
    pipeline1: {
      apiEndpoints: ["test_default"],
      policies: [
        {
          "test-policy": [
            {
              action: {
                p1: 42,
              },
            },
          ],
        },
      ],
    },
  },
};

describe("gateway policy with plugins", () => {
  const helper = testHelper();

  before("fires up a new gateway instance", () => {
    return gateway({
      plugins: {
        policies: [
          {
            name: "test-policy",
            policy(actionParams) {
              return (req, res, _next) => {
                should(actionParams.p1).be.eql(42);
                res.json({ hello: "ok", url: req.url, actionParams });
              };
            },
          },
        ],
      },
      config,
    }).then((srv) => {
      helper.setupApp(srv.app);
      return srv;
    });
  });

  after("cleanup", helper.cleanup);

  it(
    "should allow first request for host",
    helper.validateSuccess({
      setup: {
        url: "/",
        preflight: true,
      },
      test: {
        url: "/",
      },
    }),
  );
});

describe("gateway policy schema with plugins", () => {
  const helper = testHelper();

  after("cleanup", helper.cleanup);

  it("should setup policy with valid schema", () => {
    return gateway({
      plugins: {
        policies: [
          {
            name: "test-policy",
            schema: {
              $id: "http://express-gateway.io/schemas/policies/test-policy.json",
              type: "object",
              properties: {
                p1: { type: ["number"] },
              },
              required: ["p1"],
            },
            policy(actionParams) {
              return (req, res, _next) => {
                should(actionParams.p1).be.eql(42);
                res.json({ hello: "ok", url: req.url, actionParams });
              };
            },
          },
        ],
      },
      config,
    }).then((srv) => {
      helper.setupApp(srv.app);
    });
  });

  it("should throw on policy schema validation", () => {
    config.gatewayConfig.policies.push("test-policy-2");
    config.gatewayConfig.pipelines.pipeline1.policies.push({
      "test-policy-2": [
        {
          action: {},
        },
      ],
    });
    return should(
      gateway({
        plugins: {
          policies: [
            {
              name: "test-policy-2",
              schema: {
                type: "object",
                properties: {
                  p2: { type: ["number"] },
                },
                required: ["p2"],
              },
              policy() {
                should.fail();
              },
            },
          ],
        },
        config,
      }),
    ).rejected();
  });
});
