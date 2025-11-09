const should = require("should");
const config = require("../../core/config");
const services = require("../../core/services");
const tokenService = services.token;
const db = require("../../core/db");

describe("Access Token tests", () => {
  describe("Save, Find and Get Access Token tests", () => {
    let newToken,
      accessTokenFromDb,
      newTokenWithScopes,
      accessTokenFromDbWithScopes;
    beforeAll(async () => {
      await db.flushdb();
    });

    test("should save an access token", async () => {
      newToken = {
        consumerId: "1234",
        authType: "oauth2",
      };
      tokenService
        .save(newToken)
        .then((token) => {
          should.exist(token);
          token.access_token.length.should.be.greaterThan(15);
          accessTokenFromDb = token.access_token;
        })
        .catch((err) => {
          should.not.exist(err);
        });
    });

    test("should find an access token", async () => {
      tokenService
        .find(newToken)
        .then((token) => {
          token.access_token.should.eql(accessTokenFromDb);
        })
        .catch((err) => {
          should.not.exist(err);
        });
    });

    test("should get an access token", async () => {
      const tokenFields = [
        "id",
        "tokenDecrypted",
        "consumerId",
        "createdAt",
        "expiresAt",
      ];
      const [id, _tokenDecrypted] = accessTokenFromDb.split("|");

      tokenService
        .get(id)
        .then((tokenObj) => {
          tokenFields.forEach((field) => {
            should.exist(tokenObj[field]);
          });

          tokenObj.tokenDecrypted.should.eql(_tokenDecrypted);
          tokenObj.consumerId.should.eql(newToken.consumerId);
        })
        .catch((err) => {
          should.not.exist(err);
        });
    });

    test("should not create a new access token if one exists and is not expired", async () => {
      tokenService
        .findOrSave(newToken)
        .then((token) => {
          token.access_token.should.eql(accessTokenFromDb);
        })
        .catch((err) => {
          should.not.exist(err);
        });
    });

    test("should save an access token with scopes", async () => {
      newTokenWithScopes = {
        consumerId: "1234",
        authType: "oauth2",
        scopes: ["scope1", "scope2", "scope3"],
      };
      tokenService
        .save(newTokenWithScopes)
        .then((token) => {
          should.exist(token);
          token.access_token.length.should.be.greaterThan(15);
          accessTokenFromDbWithScopes = token.access_token;
        })
        .catch((err) => {
          should.not.exist(err);
        });
    });

    test("should find an access token with scopes", async () => {
      // changing the order of scopes array
      newTokenWithScopes.scopes = ["scope3", "scope2", "scope1"];

      tokenService
        .find(newTokenWithScopes)
        .then((token) => {
          token.access_token.should.eql(accessTokenFromDbWithScopes);
        })
        .catch((err) => {
          should.not.exist(err);
        });
    });

    test("should get an access token with scopes", async () => {
      const tokenFields = [
        "id",
        "tokenDecrypted",
        "consumerId",
        "createdAt",
        "expiresAt",
        "scopes",
      ];
      const [id, _tokenDecrypted] = accessTokenFromDbWithScopes.split("|");

      tokenService
        .get(id)
        .then((tokenObj) => {
          tokenFields.forEach((field) => {
            should.exist(tokenObj[field]);
          });

          tokenObj.tokenDecrypted.should.eql(_tokenDecrypted);
          tokenObj.scopes.should.eql(newTokenWithScopes.scopes);
          tokenObj.consumerId.should.eql(newTokenWithScopes.consumerId);
        })
        .catch((err) => {
          should.not.exist(err);
        });
    });

    test("should not create a new access token with scopes if one exists and is not expired", async () => {
      tokenService
        .findOrSave(newTokenWithScopes)
        .then((token) => {
          token.access_token.should.eql(accessTokenFromDbWithScopes);
        })
        .catch((err) => {
          should.not.exist(err);
        });
    });
  });

  describe("Archive Access Token tests", () => {
    let newToken, expiredToken, originalSystemConfig;

    beforeAll(async () => {
      originalSystemConfig = config.systemConfig;
      config.systemConfig.accessTokens.timeToExpiry = 0;

      return db.flushdb();
    });

    afterAll(async () => {
      config.systemConfig.accessTokens.timeToExpiry =
        originalSystemConfig.accessTokens.timeToExpiry;
    });

    test("should save an access token", async () => {
      newToken = {
        consumerId: "1234",
        authType: "oauth2",
      };
      tokenService
        .save(newToken)
        .then((token) => {
          should.exist(token);
          token.access_token.length.should.be.greaterThan(15);
          expiredToken = token.access_token;
        })
        .catch((err) => {
          should.not.exist(err);
        });
    });

    test("should not get an expired access token if not using the includeExpired flag", async () => {
      tokenService
        .get(expiredToken)
        .then((token) => {
          should.not.exist(token);
          should.equal(token, null);
        })
        .catch((err) => {
          should.not.exist(err);
        });
    });

    test("should create a new access token if one is expired", async () => {
      tokenService
        .findOrSave(newToken)
        .then((token) => {
          token.access_token.should.not.eql(expiredToken);
        })
        .catch((err) => {
          should.not.exist(err);
        });
    });

    test("should get an expired access token with includeExpired flag", async () => {
      tokenService
        .get(expiredToken, { includeExpired: true })
        .then((token) => {
          should.exist(token);
          token.id.should.eql(expiredToken.split("|")[0]);
        })
        .catch((err) => {
          should.not.exist(err);
        });
    });
  });

  describe("Get Access Tokens By Consumer", () => {
    let originalSystemConfig, tokenObjs;

    beforeAll(async () => {
      originalSystemConfig = config.systemConfig;
      config.systemConfig.accessTokens.timeToExpiry = 0;

      tokenObjs = [
        {
          consumerId: "1234",
          authType: "oauth2",
          prop: "1",
        },
        {
          consumerId: "1234",
          authType: "oauth2",
          prop: "2",
        },
        {
          consumerId: "1234",
          authType: "oauth2",
          prop: "3",
        },
        {
          consumerId: "1234",
          authType: "oauth2",
          prop: "4",
        },
      ];

      return db
        .flushdb()
        .then(() =>
          Promise.all(
            tokenObjs.map((tokenObj) => tokenService.findOrSave(tokenObj)),
          ),
        )
        .then(() => {
          config.systemConfig.accessTokens.timeToExpiry = 20000000;

          return Promise.all(
            tokenObjs.map((tokenObj) => tokenService.findOrSave(tokenObj)),
          );
        });
    });

    afterAll(() => {
      config.systemConfig = originalSystemConfig;
    });

    test("should get active access tokens by consumer", async () => {
      tokenService
        .getTokensByConsumer("1234")
        .then((tokens) => {
          should.exist(tokens);
          tokens.length.should.eql(tokenObjs.length);
          tokens.forEach((tokenObj) => {
            tokenObj.prop.should.be.oneOf(tokenObjs.map((x) => x.prop));
          });
        })
        .catch((err) => {
          should.not.exist(err);
          done(err);
        });
    });

    test("should get active and expired access tokens by consumer if provided includeExpired flag", () => {
      return tokenService
        .getTokensByConsumer("1234", { includeExpired: true })
        .then((tokens) => {
          should.exist(tokens);
          tokens.length.should.eql(tokenObjs.length * 2);
          tokens.forEach((tokenObj) => {
            tokenObj.prop.should.be.oneOf(tokenObjs.map((x) => x.prop));
          });
          // it tests number of archived tokens
          tokens
            .map((x) => x.archived)
            .filter((val) => val)
            .length.should.eql(4);
        });
    });
  });
});

describe("Refresh Token tests", () => {
  describe("Save, Find and Get Refresh Token tests", () => {
    let newToken, tokensFromDb, newTokenWithScopes, tokensFromDbWithScopes;
    beforeAll(async () => {
      return db.flushdb();
    });

    test("should save a refresh token along with access token", async () => {
      newToken = {
        consumerId: "1234",
        authType: "oauth2",
      };
      tokenService
        .save(newToken, { includeRefreshToken: true })
        .then((token) => {
          should.exist(token);
          should.exist(token.access_token);
          should.exist(token.refresh_token);
          token.access_token.length.should.be.greaterThan(15);
          token.refresh_token.length.should.be.greaterThan(15);
          tokensFromDb = token;
        })
        .catch((err) => {
          should.not.exist(err);
        });
    });

    test("should find a refresh token along with access token", async () => {
      tokenService
        .find(newToken, { includeRefreshToken: true })
        .then((token) => {
          token.should.eql(tokensFromDb);
        })
        .catch((err) => {
          should.not.exist(err);
        });
    });

    test("should get refresh token's original token Obj", async () => {
      tokenService
        .getTokenObject(tokensFromDb.refresh_token)
        .then((tokenObj) => {
          tokenObj.should.eql(newToken);
        })
        .catch((err) => {
          should.not.exist(err);
        });
    });

    test("should get a refresh token", async () => {
      const tokenFields = [
        "id",
        "tokenDecrypted",
        "consumerId",
        "createdAt",
        "expiresAt",
      ];
      const [id, _tokenDecrypted] = tokensFromDb.refresh_token.split("|");

      tokenService
        .get(id, { type: "refresh_token" })
        .then((tokenObj) => {
          tokenFields.forEach((field) => {
            should.exist(tokenObj[field]);
          });

          tokenObj.tokenDecrypted.should.eql(_tokenDecrypted);
          tokenObj.consumerId.should.eql(newToken.consumerId);
        })
        .catch((err) => {
          should.not.exist(err);
        });
    });

    test("should not create a new refresh token if one exists and is not expired", async () => {
      tokenService
        .findOrSave(newToken, { includeRefreshToken: true })
        .then((token) => {
          token.should.eql(tokensFromDb);
        })
        .catch((err) => {
          should.not.exist(err);
        });
    });

    test("should save a refresh token with scopes, along with an access token", async () => {
      newTokenWithScopes = {
        consumerId: "1234",
        authType: "oauth2",
        scopes: ["scope1", "scope2", "scope3"],
      };
      tokenService
        .save(newTokenWithScopes, { includeRefreshToken: true })
        .then((token) => {
          should.exist(token);
          token.access_token.length.should.be.greaterThan(15);
          token.refresh_token.length.should.be.greaterThan(15);
          tokensFromDbWithScopes = token;
        })
        .catch((err) => {
          should.not.exist(err);
        });
    });

    test("should find a refresh token with scopes", async () => {
      // changing the order of scopes array
      newTokenWithScopes.scopes = ["scope3", "scope2", "scope1"];

      tokenService
        .find(newTokenWithScopes, { includeRefreshToken: true })
        .then((token) => {
          token.should.eql(tokensFromDbWithScopes);
        })
        .catch((err) => {
          should.not.exist(err);
        });
    });

    test("should get a refresh token with scopes", async () => {
      const tokenFields = [
        "id",
        "tokenDecrypted",
        "consumerId",
        "createdAt",
        "expiresAt",
        "scopes",
      ];
      const [id, _tokenDecrypted] =
        tokensFromDbWithScopes.refresh_token.split("|");

      tokenService
        .get(id, { type: "refresh_token" })
        .then((tokenObj) => {
          tokenFields.forEach((field) => {
            should.exist(tokenObj[field]);
          });

          tokenObj.tokenDecrypted.should.eql(_tokenDecrypted);
          tokenObj.scopes.should.eql(newTokenWithScopes.scopes);
          tokenObj.consumerId.should.eql(newTokenWithScopes.consumerId);
        })
        .catch((err) => {
          should.not.exist(err);
        });
    });

    test("should not create a new refresh token with scopes if one exists and is not expired", async () => {
      tokenService
        .findOrSave(newTokenWithScopes, { includeRefreshToken: true })
        .then((token) => {
          token.should.eql(tokensFromDbWithScopes);
        })
        .catch((err) => {
          should.not.exist(err);
        });
    });
  });

  describe("Archive Refresh Token tests", () => {
    let newToken, expiredToken, originalSystemConfig, activeRefreshToken;

    beforeAll(async () => {
      originalSystemConfig = config.systemConfig;
      config.systemConfig.accessTokens.timeToExpiry = 0;
      config.systemConfig.refreshTokens.timeToExpiry = 0;

      return db.flushdb();
    });

    afterAll(async () => {
      config.systemConfig = originalSystemConfig;
    });

    test("should save a refresh token", async () => {
      newToken = {
        consumerId: "1234",
        authType: "oauth2",
      };
      tokenService
        .save(newToken, { includeRefreshToken: true })
        .then((token) => {
          should.exist(token);
          token.access_token.length.should.be.greaterThan(15);
          token.refresh_token.length.should.be.greaterThan(15);
          expiredToken = token;
        })
        .catch((err) => {
          should.not.exist(err);
        });
    });

    test("should not find an expired refresh token if not using the includeExpired flag", async () => {
      tokenService
        .find(newToken, { includeRefreshToken: true })
        .then((token) => {
          should.not.exist(token.access_token);
          should.not.exist(token.refresh_token);
        })
        .catch((err) => {
          should.not.exist(err);
        });
    });

    test("should create a new refresh token if one is expired", async () => {
      config.systemConfig.refreshTokens.timeToExpiry = 9999999;
      tokenService
        .findOrSave(newToken, { includeRefreshToken: true })
        .then((token) => {
          token.should.not.eql(expiredToken);
          token.refresh_token.should.not.eql(expiredToken.refresh_token);
          activeRefreshToken = token.refresh_token;
        })
        .catch((err) => {
          should.not.exist(err);
        });
    });

    test("should not create a new refresh token if one is not expired, even if the access token is expired", async () => {
      tokenService
        .findOrSave(newToken, { includeRefreshToken: true })
        .then((token) => {
          token.access_token.should.not.eql(expiredToken.access_token);
          token.refresh_token.should.eql(activeRefreshToken);
        })
        .catch((err) => {
          should.not.exist(err);
        });
    });

    test("should create a new refresh token if one does not exist, even if the access token is exists", async () => {
      const tokenObj = {
        consumerId: "555555",
        authType: "oauth2",
      };
      let accessToken;
      config.systemConfig.accessTokens.timeToExpiry = 9999999;

      tokenService
        .findOrSave(tokenObj)
        .then((token) => {
          should.exist(token.access_token);
          should.not.exist(token.refresh_token);
          accessToken = token.access_token;

          tokenService
            .findOrSave(tokenObj, { includeRefreshToken: true })
            .then((token) => {
              token.access_token.should.eql(accessToken);
              should.exist(token.refresh_token);
            });
        })
        .catch((err) => {
          should.not.exist(err);
        });
    });

    test("should find an expired refresh token with includeExpired flag", async () => {
      tokenService
        .get(expiredToken.refresh_token, {
          includeExpired: true,
          type: "refresh_token",
        })
        .then((token) => {
          should.exist(token);
          token.id.should.eql(expiredToken.refresh_token.split("|")[0]);
        })
        .catch((err) => {
          should.not.exist(err);
        });
    });
  });

  describe("Get Refresh Tokens By Consumer", () => {
    let originalSystemConfig, tokenObjs;

    beforeAll(async () => {
      originalSystemConfig = config.systemConfig;
      config.systemConfig.refreshTokens.timeToExpiry = 0;
      // config.systemConfig.accessTokens.timeToExpiry = 0;

      tokenObjs = [
        {
          consumerId: "1234",
          authType: "oauth2",
          prop: "1",
        },
        {
          consumerId: "1234",
          authType: "oauth2",
          prop: "2",
        },
        {
          consumerId: "1234",
          authType: "oauth2",
          prop: "3",
        },
        {
          consumerId: "1234",
          authType: "oauth2",
          prop: "4",
        },
      ];

      db.flushdb()
        .then(() => {
          const expiredTokenPromises = [];

          tokenObjs.forEach((tokenObj) => {
            expiredTokenPromises.push(
              tokenService.findOrSave(tokenObj, { includeRefreshToken: true }),
            );
          });

          Promise.all(expiredTokenPromises).then(() => {
            config.systemConfig.refreshTokens.timeToExpiry = 20000000;
            // config.systemConfig.accessTokens.timeToExpiry = 20000000;

            const activeTokenPromises = [];

            tokenObjs.forEach((tokenObj) => {
              activeTokenPromises.push(
                tokenService.findOrSave(tokenObj, {
                  includeRefreshToken: true,
                }),
              );
            });

            Promise.all(activeTokenPromises).then((res) => {
              should.exist(res);
            });
          });
        })
        .catch((err) => {
          should.not.exist(err);
        });
    });

    afterAll(async () => {
      config.systemConfig = originalSystemConfig;
    });

    test("should get active tokens by consumer", async () => {
      tokenService
        .getTokensByConsumer("1234", { type: "refresh_token" })
        .then((tokens) => {
          should.exist(tokens);
          tokens.length.should.eql(tokenObjs.length);
          tokens.forEach((tokenObj) => {
            tokenObj.prop.should.be.oneOf(tokenObjs.map((x) => x.prop));
          });
        })
        .catch((err) => {
          should.not.exist(err);
        });
    });

    test("should get active and expired tokens by consumer if provided includeExpired flag", async () => {
      tokenService
        .getTokensByConsumer("1234", {
          includeExpired: true,
          type: "refresh_token",
        })
        .then((tokens) => {
          should.exist(tokens);
          tokens.length.should.eql(tokenObjs.length * 2);
          tokens.forEach((tokenObj) => {
            tokenObj.prop.should.be.oneOf(tokenObjs.map((x) => x.prop));
          });
          tokens
            .map((x) => x.archived)
            .filter((val) => val)
            .length.should.eql(4);
        })
        .catch((err) => {
          should.not.exist(err);
        });
    });
  });
});
