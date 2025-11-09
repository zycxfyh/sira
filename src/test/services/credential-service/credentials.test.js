const should = require("should");
const config = require("../../../core/config");
const services = require("../../../core/services");
const schemas = require("../../../core/schemas");
const credentialService = services.credential;
const userService = services.user;
const db = require("../../../core/db");

describe("Credential tests", () => {
  const username = "someUser";
  const credential = {
    secret: "password",
  };

  function insertCredential(type) {
    return credentialService.insertCredential(username, type, credential);
  }

  beforeEach(() => db.flushdb());

  describe("'oauth2' specific cases", () => {
    const type = "oauth2";

    test("should not insert a credential that already exists", () => {
      return insertCredential(type).then((_newCredential) => {
        return should(insertCredential(type)).be.rejected();
      });
    });

    test("should insert a credential without password specified if autoGeneratePassword is set to true", () => {
      return credentialService
        .insertCredential(username, type, {})
        .then((newCredential) => {
          should.exist(newCredential);
          should.exist(newCredential.secret);
          should(newCredential.secret.length).greaterThanOrEqual(10);
        });
    });

    test("should insert a credential with id but different type that already exists", () => {
      return insertCredential(type)
        .then(() =>
          credentialService.insertCredential(
            username,
            "basic-auth",
            credential,
          ),
        )
        .then((newCredential) => {
          should.exist(newCredential);
          newCredential.isActive.should.eql(true);
        });
    });
  });

  describe("support for multiple credentials", () => {
    ["key-auth", "jwt"].forEach((type) => {
      test(type, () => {
        return Promise.all([insertCredential(type), insertCredential(type)])
          .then(() => credentialService.getCredentials(username))
          .then((results) => {
            results.should.be.instanceOf(Array).and.have.length(2);
          });
      });
    });
  });

  const tests = [
    { type: "oauth2", passwordKey: "secret" },
    { type: "basic-auth", passwordKey: "password" },
    { type: "key-auth" },
    { type: "jwt" },
  ];

  tests.forEach(({ type, passwordKey }) => {
    describe(`credential type: '${type}'`, () => {
      test("should insert a credential", () => {
        return insertCredential(type);
      });

      test("should get a credential and strip 'passwordKey' props", () => {
        return insertCredential(type)
          .then((credential) =>
            credentialService.getCredential(credential.id, type),
          )
          .then((credential) => {
            should.exist(credential);
            if (passwordKey) {
              should.not.exist(credential.passwordKey);
              should.not.exist(credential[passwordKey]);
            }
            credential.isActive.should.eql(true);
          });
      });

      test("should deactivate a credential", () => {
        return insertCredential(type)
          .then((credential) => {
            return credentialService
              .deactivateCredential(credential.id, type)
              .then((res) => {
                should.exist(res);
                return credentialService.getCredential(credential.id, type);
              });
          })
          .then((credential) => {
            should.exist(credential);
            credential.isActive.should.eql(false);
          });
      });

      test("should reactivate a credential", () => {
        return insertCredential(type)
          .then((credential) => {
            return credentialService
              .activateCredential(credential.id, type)
              .then((res) => {
                should.exist(res);
                return credentialService.getCredential(credential.id, type);
              });
          })
          .then((credential) => {
            should.exist(credential);
            credential.isActive.should.eql(true);
          });
      });
    });
  });
});

describe("Credential service tests", () => {
  let user;

  beforeAll(async () => {
    user = {
      username: "irfanbaqui",
      firstname: "irfan",
      lastname: "baqui",
      email: "irfan@eg.com",
    };

    await db.flushdb();
    const newUser = await userService.insert(user);
    user = newUser;
    await Promise.all([
      credentialService
        .insertCredential(user.id, "oauth2")
        .then((oauthCred) => should.exist(oauthCred.secret)),
      credentialService
        .insertCredential(user.id, "basic-auth")
        .then((basicAuthCred) => should.exist(basicAuthCred.password)),
    ]);
  });

  describe("Credential Cascade Delete tests", () => {
    test("should delete all credentials associated with a user when user is deleted", () => {
      return Promise.all([
        credentialService.getCredential(user.id, "oauth2"),
        credentialService.getCredential(user.id, "basic-auth"),
      ])
        .then(([oauthRes, basicAuthRes]) => {
          should.exist(oauthRes); // Check to confirm the credentials exist
          should.exist(basicAuthRes);
          return userService.remove(user.id);
        })
        .then((res) => {
          should.exist(res);
          return Promise.all([
            credentialService.getCredential(user.id, "oauth2"),
            credentialService.getCredential(user.id, "basic-auth"),
          ]);
        })
        .then(([oauthResAfterDelete, basicAuthResAfterDelete]) => {
          should.not.exist(oauthResAfterDelete);
          should.not.exist(basicAuthResAfterDelete);
        });
    });

    test("should delete a credential", () => {
      return credentialService
        .insertCredential(user.id, "oauth2")
        .then((res) => {
          should.exist(res);
          return credentialService.removeCredential(user.id, "oauth2");
        })
        .then((deleted) => {
          should(deleted).be.equal(1);
          return credentialService.getCredential(user.id, "oauth2");
        })
        .then((resAfterDelete) => should.not.exist(resAfterDelete));
    });
  });

  describe("Credential Property tests", () => {
    const originalModelConfig = JSON.parse(
      JSON.stringify(config.models.credentials),
    );
    const username = "someUser";
    const _credential = {
      secret: "password",
      scopes: ["someScope"],
      someProperty: "propVal",
    };

    beforeAll(async () => {
      Object.assign(config.models.credentials.properties.oauth2.properties, {
        someProperty: { type: "string" },
        otherProperty: { type: "string", default: "someDefaultValue" },
      });

      config.models.credentials.properties.oauth2.required.push("someProperty");
      schemas.register("credentials", "credential", config.models.credentials);
      await db.flushdb();
    });

    afterAll(() => {
      config.models.credentials = originalModelConfig;
      schemas.register("credentials", "credential", config.models.credentials);
    });

    test("should not insert a credential with scopes if the scopes are not defined", () => {
      return should(
        credentialService.insertCredential(username, "oauth2", _credential),
      ).be.rejectedWith("One or more scopes don't exist");
    });

    test("should insert a credential with scopes if the scopes are defined", () => {
      return credentialService
        .insertScopes(["someScope"])
        .then(() =>
          credentialService.insertCredential(username, "oauth2", _credential),
        )
        .then((newCredential) => {
          should.exist(newCredential);
          should.exist(newCredential.scopes);
          should.not.exist(newCredential.secret);

          should(newCredential.isActive).eql(true);
          should(newCredential.scopes).eql(["someScope"]);
          should(newCredential.someProperty).eql("propVal");
        });
    });

    test("should add scopes to existing credential if the scopes are defined", () => {
      return credentialService
        .insertScopes([
          "someScope1",
          "someScope2",
          "someScope3",
          "someOtherOne",
        ])
        .then(() =>
          credentialService.addScopesToCredential(username, "oauth2", [
            "someScope1",
            "someScope2",
            "someScope3",
            "someOtherOne",
          ]),
        )
        .then((_res) => {
          credentialService.getCredential(username, "oauth2").then((cred) => {
            should.exist(cred);
            should.exist(cred.scopes);
            cred.isActive.should.eql(true);
            cred.scopes.should.containEql(..._credential.scopes);
            cred.scopes.should.containEql("someScope1");
            cred.scopes.should.containEql("someScope2");
            cred.scopes.should.containEql("someScope3");
            cred.scopes.should.containEql("someOtherOne");
          });
        });
    });

    test("should remove scopes from existing credential", () => {
      return credentialService
        .removeScopesFromCredential(username, "oauth2", [
          "someScope2",
          "someScope3",
        ])
        .then(() => credentialService.getCredential(username, "oauth2"))
        .then((cred) => {
          should.exist(cred);
          should.exist(cred.scopes);
          cred.scopes.should.containEql(..._credential.scopes);
          cred.scopes.should.containEql("someScope1");
          cred.scopes.should.not.containEql("someScope2");
          cred.scopes.should.not.containEql("someScope3");
          cred.isActive.should.eql(true);
        });
    });

    test("should remove scopes from credential if the scope is deleted", () => {
      return credentialService
        .removeScopes(["someScope1", "someScope"])
        .then(() => credentialService.getCredential(username, "oauth2"))
        .then((cred) => {
          should.exist(cred);
          should.exist(cred.scopes);
          cred.scopes.should.containEql("someOtherOne");
          cred.scopes.should.not.containEql("someScope1");
          cred.scopes.should.not.containEql("someScope");
          cred.isActive.should.eql(true);
        });
    });

    test("should not add scopes to existing credential if the scopes are not defined", () => {
      return should(
        credentialService.addScopesToCredential(username, "oauth2", [
          "undefinedScope",
        ]),
      ).be.rejectedWith("One or more scopes don't exist");
    });

    test("should use default property if not defined", () => {
      const username2 = "otherUser";
      const cred = {
        secret: "password",
        scopes: ["someOtherOne"],
        someProperty: "propVal",
      };

      return credentialService
        .insertCredential(username2, "oauth2", cred)
        .then((newCredential) => {
          should.exist(newCredential);
          newCredential.isActive.should.eql(true);
          should.exist(newCredential.scopes);
          newCredential.scopes.should.eql(["someOtherOne"]);
          newCredential.someProperty.should.eql("propVal");
          should.not.exist(newCredential.secret);
          newCredential.otherProperty.should.eql("someDefaultValue");
        });
    });

    test("should not create credential if a required property is not passed in", () => {
      const username3 = "anotherUser";
      const cred = {
        secret: "password",
        scopes: ["someScope"],
      };

      return should(
        credentialService.insertCredential(username3, "oauth2", cred),
      )
        .be.rejectedWith("data should have required property 'someProperty'")
        .then(() => credentialService.getCredential(username3, "oauth2"))
        .then((credential) => should.not.exist(credential));
    });

    test("should not update credential when no properties are specified", () => {
      return credentialService
        .updateCredential(username, "oauth2", {})
        .then((newCredential) => {
          should.not.exist(newCredential);
          return credentialService.getCredential(username, "oauth2");
        })
        .then((credential) => {
          should.exist(credential);
        });
    });
  });
});
