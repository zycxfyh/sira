const should = require("should");
const uuid = require("uuid");
const redisConfig = require("../../core/config").systemConfig.db.redis;
const services = require("../../core/services");
const userService = services.user;
const credentialService = services.credential;
const db = require("../../core/db");

describe("User service tests", () => {
  describe("Insert tests", () => {
    beforeAll(async () => {
      await db.flushdb();
    });

    test("should insert a user", () => {
      const user = {
        username: "irfanbaqui",
        firstname: "irfan",
        lastname: "baqui",
        email: "irfan@eg.com",
      };

      return userService.insert(user).then((newUser) => {
        const expectedUserProps = [
          "firstname",
          "lastname",
          "email",
          "isActive",
          "username",
          "id",
          "createdAt",
          "updatedAt",
        ];
        should(Object.keys(newUser)).containDeep(expectedUserProps);
        newUser.should.have.properties(user);
        should.ok(newUser.isActive);
        return db
          .hgetall(
            redisConfig.namespace.concat("-", "user").concat(":", newUser.id),
          )
          .then((userObj) => {
            userObj.isActive = userObj.isActive === "true";
            should.deepEqual(userObj, newUser);
          });
      });
    });

    test("should throw an error when inserting a user with missing properties", () => {
      const user = {
        username: "irfanbaqui-1",
        lastname: "baqui",
        email: "irfan@eg.com",
      };

      return should(userService.insert(user)).be.rejectedWith(
        "data should have required property 'firstname'",
      );
    });

    test("should throw an error when inserting a user with existing username", () => {
      const user = {
        username: "irfanbaqui",
        firstname: "irfan",
        lastname: "baqui",
        email: "irfan@eg.com",
      };

      return should(userService.insert(user)).be.rejectedWith(
        "username already exists",
      );
    });
  });

  describe("Get and Find User tests", () => {
    let user;
    beforeAll(async () =>
      db
        .flushdb()
        .then(() => {
          user = createRandomUserObject();
          return userService.insert(user);
        })
        .then((newUser) => {
          should.exist(newUser);
          user.id = newUser.id;
        }),
    );

    test("should get user by userId", () => {
      return userService.get(user.id).then((_user) => {
        const expectedUserProps = [
          "firstname",
          "lastname",
          "email",
          "isActive",
          "username",
          "id",
          "createdAt",
          "updatedAt",
        ];
        should.exist(_user);
        expectedUserProps.sort().should.eql(Object.keys(_user).sort());
        _user.id.length.should.be.greaterThan(10);
        _user.isActive.should.eql(true);

        _user.should.have.properties({
          firstname: user.firstname,
          lastname: user.lastname,
          email: user.email,
          username: user.username,
        });
      });
    });

    test("should get user all users", () => {
      return userService.findAll().then((data) => {
        should.exist(data.users);
        should.exist(data.nextKey);
        data.users.length.should.be.eql(1);
        const _user = data.users[0];
        const expectedUserProps = [
          "firstname",
          "lastname",
          "email",
          "isActive",
          "username",
          "id",
          "createdAt",
          "updatedAt",
        ];
        should.exist(user);
        expectedUserProps.sort().should.eql(Object.keys(_user).sort());
        _user.id.length.should.be.greaterThan(10);
        _user.isActive.should.eql(true);

        _user.should.have.properties({
          firstname: user.firstname,
          lastname: user.lastname,
          email: user.email,
          username: user.username,
        });
      });
    });

    test("should not get user by invalid userId", () => {
      return userService.get(uuid.v4()).then((user) => {
        should.exist(user);
        user.should.eql(false);
      });
    });

    test("should find user by username", () => {
      return userService.find(user.username).then((_user) => {
        const expectedUserProps = [
          "firstname",
          "lastname",
          "email",
          "isActive",
          "username",
          "id",
          "createdAt",
          "updatedAt",
        ];
        should.exist(_user);
        expectedUserProps.sort().should.eql(Object.keys(_user).sort());
        _user.id.length.should.be.greaterThan(10);
        _user.isActive.should.eql(true);
        _user.should.have.properties({
          firstname: user.firstname,
          lastname: user.lastname,
          email: user.email,
          username: user.username,
        });
      });
    });

    test("should not find user by invalid username", () => {
      return userService.find("invalid_username").then((user) => {
        should.exist(user);
        user.should.eql(false);
      });
    });
  });

  describe("Update user tests", () => {
    let user, updatedUser;
    beforeAll(async () => {
      return db.flushdb().then(() => {
        user = createRandomUserObject();
        return userService.insert(user).then((newUser) => {
          should.exist(newUser);
          user.id = newUser.id;
          user.createdAt = newUser.createdAt;
        });
      });
    });

    test("should update user", () => {
      updatedUser = createRandomUserObject();
      return userService.update(user.id, updatedUser).then((res) => {
        should.exist(res);
        res.should.eql(true);
        return userService.get(user.id).then((_user) => {
          _user.username.should.eql(user.username); // Cannot update username
          _user.email.should.eql(updatedUser.email);
          _user.firstname.should.eql(updatedUser.firstname);
          _user.lastname.should.eql(updatedUser.lastname);
          _user.createdAt.should.eql(user.createdAt);
        });
      });
    });

    test("should allow update of any single user property user", () => {
      const anotherUpdatedUser = {
        email: "baq@eg.com",
      };

      return userService.update(user.id, anotherUpdatedUser).then((res) => {
        res.should.eql(true);
        return userService.get(user.id).then((_user) => {
          _user.email.should.eql(anotherUpdatedUser.email);
          _user.firstname.should.eql(updatedUser.firstname);
          _user.lastname.should.eql(updatedUser.lastname);
          _user.createdAt.should.eql(user.createdAt);
        });
      });
    });

    test("should not update user with unvalid id", () => {
      const updatedUser = {
        username: "joecamper",
        firstname: "Joe",
        lastname: "Camper",
        email: "joecamper@eg.com",
      };

      return userService.update("invalid_id", updatedUser).then((res) => {
        should.exist(res);
        res.should.eql(false);
      });
    });

    test("should not update user with invalid properties", () => {
      const updatedUser = {
        username: "joecamper",
        invalid_prop: "xyz111",
      };

      return should(userService.update(user.id, updatedUser)).be.rejectedWith(
        "one or more properties is invalid",
      );
    });
  });

  describe("Activate and deactivate user tests", () => {
    let user;
    beforeAll(async () =>
      db
        .flushdb()
        .then(() => {
          return userService.insert(createRandomUserObject());
        })
        .then((newUser) => {
          user = newUser; // update test user
          should.exist(newUser);
          user.id = newUser.id;
        }),
    );

    test("should deactivate user", (done) => {
      userService.deactivate(user.id).then((res) => {
        should.exist(res);
        res.should.eql(true);
        return userService
          .get(user.id)
          .then((_user) => {
            should.exist(_user.username);
            _user.username.should.eql(user.username);
            should.exist(_user.email);
            _user.email.should.eql(user.email);
            should.exist(_user.firstname);
            _user.firstname.should.eql(user.firstname);
            should.exist(_user.lastname);
            _user.lastname.should.eql(user.lastname);
            should.exist(_user.isActive);
            _user.isActive.should.eql(false);
            should.exist(_user.createdAt);
            _user.createdAt.should.eql(user.createdAt);
            should.exist(_user.updatedAt);
            done();
          })
          .catch(done);
      });
    });

    test("should reactivate user", (done) => {
      userService.activate(user.id).then((res) => {
        res.should.eql(true);
        return userService
          .get(user.id)
          .then((_user) => {
            _user.username.should.eql(user.username);
            _user.email.should.eql(user.email);
            _user.firstname.should.eql(user.firstname);
            _user.lastname.should.eql(user.lastname);
            _user.isActive.should.eql(true);
            _user.createdAt.should.eql(user.createdAt);
            should.exist(_user.updatedAt);
            done();
          })
          .catch(done);
      });
    });
  });

  describe("Delete user tests", () => {
    let user;
    beforeEach(() =>
      db
        .flushdb()
        .then(() => {
          user = createRandomUserObject();
          return userService.insert(user);
        })
        .then((newUser) => {
          should.exist(newUser);
          user.id = newUser.id;
        }),
    );

    test("should delete user", () => {
      return userService.remove(user.id).then((deleted) => {
        should.exist(deleted);
        deleted.should.eql(true);
      });
    });

    test("should not delete user with invalid id", () => {
      return userService.remove("invalid_id").then((deleted) => {
        should.exist(deleted);
        deleted.should.eql(false);
      });
    });

    describe("should delete all the related credentials", () => {
      const credentials = [];
      beforeAll(async () =>
        Promise.all([
          credentialService.insertScopes(["someScope"]),
          credentialService.insertCredential(user.id, "jwt"),
          credentialService.insertCredential(user.id, "jwt"),
        ]).then(([_scope, jwt1, jwt2]) =>
          Promise.all(
            [jwt1, jwt2].map((cred) => {
              credentials.push(cred);
              return credentialService.addScopesToCredential(cred.id, "jwt", [
                "someScope",
              ]);
            }),
          ),
        ),
      );

      test("should remove the user", () => {
        return should(userService.remove(user.id)).resolvedWith(true);
      });

      test("should remove the credentials", () => {
        return should(
          credentialService.getCredential(credentials[0].id, "jwt"),
        ).resolvedWith(null);
      });
    });
  });
});

function createRandomUserObject() {
  return {
    username: uuid.v4(),
    firstname: uuid.v4(),
    lastname: uuid.v4(),
    email: `${uuid.v4()}@testmail.it`,
  };
}
