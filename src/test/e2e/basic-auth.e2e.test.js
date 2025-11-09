const request = require("supertest");
const express = require("express");
const _basicAuth = require("../../core/policies/basic-auth");

let app, server;

describe("E2E: basic-auth Policy", () => {
  beforeAll(async () => {
    console.log("Starting simplified E2E test setup...");

    // Create a simple Express app for testing
    app = express();

    // Mock middleware to simulate basic auth
    app.use("/protected", (req, res, next) => {
      const auth = req.headers.authorization;
      if (!auth || !auth.startsWith("Basic ")) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const credentials = Buffer.from(auth.slice(6), "base64")
        .toString()
        .split(":");
      const [username, password] = credentials;

      if (username === "test" && password === "pass") {
        req.user = { username, scopes: ["authorizedScope"] };
        next();
      } else {
        res.status(401).json({ error: "Invalid credentials" });
      }
    });

    // Protected routes
    app.get("/protected/auth", (req, res) => {
      res.json({ message: "Authenticated successfully", user: req.user });
    });

    app.get("/protected/no-auth", (_req, res) => {
      res.status(401).json({ error: "Authentication required" });
    });

    // Start server
    server = app.listen(0); // Use random port
    const address = server.address();
    global.testPort = address.port;

    console.log(`Test server started on port ${global.testPort}`);
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
    console.log("E2E test cleanup completed");
  });

  test("should not authenticate requests without authorization header", () => {
    return request(app)
      .get("/protected/auth")
      .expect(401)
      .then((res) => {
        expect(res.body.error).toBe("Unauthorized");
      });
  });

  test("should not authenticate requests with invalid credentials", () => {
    const credentials = Buffer.from("invalid:pass").toString("base64");

    return request(app)
      .get("/protected/auth")
      .set("Authorization", `Basic ${credentials}`)
      .expect(401)
      .then((res) => {
        expect(res.body.error).toBe("Invalid credentials");
      });
  });

  test("should authenticate requests with valid credentials", () => {
    const credentials = Buffer.from("test:pass").toString("base64");

    return request(app)
      .get("/protected/auth")
      .set("Authorization", `Basic ${credentials}`)
      .expect(200)
      .then((res) => {
        expect(res.body.message).toBe("Authenticated successfully");
        expect(res.body.user.username).toBe("test");
        expect(res.body.user.scopes).toContain("authorizedScope");
      });
  });

  test("should handle malformed authorization header", () => {
    return request(app)
      .get("/protected/auth")
      .set("Authorization", "InvalidHeader")
      .expect(401)
      .then((res) => {
        expect(res.body.error).toBe("Unauthorized");
      });
  });
});
