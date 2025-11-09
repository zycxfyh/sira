const should = require("should");
const services = require("../../core/services");
const authCodeService = services.authorizationCode;
const db = require("../../core/db");

describe("Authorization Code Tests", () => {
  let newCode, codeFromDb;

  beforeAll(async () => {
    return db.flushdb();
  });

  test("should save a code", (done) => {
    newCode = {
      consumerId: "clientId",
      userId: "userId",
      redirectUri: "redirectUri",
      scopes: ["scope1", "scope2"],
    };

    authCodeService
      .save(newCode)
      .then((code) => {
        should.exist(code);
        should.exist(code.id);
        code.id.length.should.be.greaterThan(15);
        should.ok(new Date(code.expiresAt) > Date.now());
        code.should.have.properties(newCode);
        codeFromDb = code;
        done();
      })
      .catch(done);
  });

  test("should find a code", (done) => {
    const criteria = Object.assign(newCode, { id: codeFromDb.id });

    authCodeService
      .find(criteria)
      .then((code) => {
        codeFromDb.should.deepEqual(code);
        done();
      })
      .catch(done);
  });

  test("should not find a code the second time", (done) => {
    const criteria = Object.assign(newCode, { id: codeFromDb.id });

    authCodeService
      .find(criteria)
      .then((code) => {
        should.not.exist(code);
        done();
      })
      .catch(done);
  });
});
