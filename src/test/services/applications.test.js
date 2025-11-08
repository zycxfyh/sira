const should = require('should');
const uuid = require('uuid');
const config = require('../../../src/core/config');
const schemas = require('../../../src/core/schemas');
const services = require('../../../src/core/services');
const applicationService = services.application;
const userService = services.user;
const db = require('../../../src/core/db');

describe('Application service tests', () => {
  let originalAppModelConfig;

  before(() => {
    originalAppModelConfig = Object.assign({}, config.models.applications.properties);
    Object.assign(config.models.applications.properties, {
      group: { type: 'string', default: 'someGroup' },
      irrelevantProp: { type: 'string' },
    });

    schemas.register('model', 'application', config.models.applications);
  });

  after(() => {
    config.models.applications.properties = originalAppModelConfig;
    schemas.register('model', 'application', config.models.applications);
  });

  describe('Insert tests', () => {
    before(() => db.flushdb());

    let user;

    it('should insert an application and application should have default value of properties if not defined, and un-required properties ignored if not defined', () => {
      const _user = createRandomUserObject();
      let app;

      return userService
        .insert(_user)
        .then(newUser => {
          user = newUser;
          should.exist(user.id);
          app = {
            name: 'test-app-1',
          };

          return applicationService.insert(app, user.id);
        })
        .then(newApp => {
          should.exist(newApp);
          should(newApp).have.properties([
            'id',
            'name',
            'isActive',
            'group',
            'createdAt',
            'userId',
          ]);
          newApp.isActive.should.eql(true);
          newApp.name.should.eql(app.name);
          newApp.group.should.eql('someGroup');
          should(newApp).not.have.property('irrelevantProp');
          newApp.userId.should.eql(user.id);
        });
    });

    it('should throw when inserting an app with missing properties that are required', () => {
      return should(applicationService.insert({}, user.id)).be.rejectedWith(
        "data should have required property 'name'"
      );
    });

    it('should allow inserting multiple applications per user', () => {
      const app = {
        name: 'test-app-2',
      };

      return applicationService.insert(app, user.id).then(newApp => {
        should.exist(newApp);
        should(newApp).have.properties(['id', 'name', 'isActive', 'createdAt', 'userId']);
        newApp.name.should.eql(app.name);
        newApp.userId.should.eql(user.id);
      });
    });
  });

  describe('Get application tests', () => {
    let user, app;

    before(() => {
      const _user = createRandomUserObject();
      return db
        .flushdb()
        .then(() => userService.insert(_user))
        .then(newUser => {
          should.exist(newUser);
          user = newUser;
          app = {
            name: 'test-app',
          };
          return applicationService.insert(app, user.id);
        })
        .then(newApp => {
          should.exist(newApp);
          app = newApp;
        });
    });

    it('should get app by id', () => {
      return applicationService.get(app.id).then(_app => {
        should.exist(_app);
        should(_app).have.properties(['id', 'name', 'createdAt', 'updatedAt']);
        _app.id.should.eql(app.id);
        _app.name.should.eql(app.name);
      });
    });

    it('should get all apps', () => {
      return applicationService.findAll().then(data => {
        should.exist(data.apps);
        data.apps.length.should.eql(1);
        const app = data.apps[0];
        should.exist(app);
        should(app).have.properties(['id', 'name', 'createdAt', 'updatedAt']);
        app.id.should.eql(app.id);
        app.name.should.eql(app.name);
      });
    });

    it('should not get app by invalid id', () => {
      return applicationService.get('invalid_id').then(_app => {
        should.exist(_app);
        _app.should.eql(false);
      });
    });

    it('should get all apps belonging to a user', () => {
      let user1, app1, app2;

      return userService
        .insert(createRandomUserObject())
        .then(newUser => {
          should.exist(newUser);
          user1 = newUser;
          app1 = {
            name: 'test-app-1',
          };
          return applicationService.insert(app1, user1.id).then(newApp => {
            should.exist(newApp);
            app1 = newApp;
          });
        })
        .then(() => {
          app2 = {
            name: 'test-app-2',
          };
          return applicationService.insert(app2, user1.id).then(newApp => {
            should.exist(newApp);
            app2 = newApp;
          });
        })
        .then(() => {
          return applicationService.getAll(user1.id).then(apps => {
            should.exist(apps);
            apps.length.should.eql(2);
            app1.should.oneOf(apps);
            app2.should.oneOf(apps);
          });
        });
    });
  });

  describe('Update tests', () => {
    let user, app;

    before(() => db.flushdb());

    it('should update an application', () => {
      const _user = createRandomUserObject();

      return userService
        .insert(_user)
        .then(newUser => {
          user = newUser;
          should.exist(user.id);
          app = {
            name: 'test-app-1',
          };

          return applicationService.insert(app, user.id);
        })
        .then(newApp => {
          app = newApp;
          should.exist(newApp);
          should(newApp).have.properties(['id', 'name', 'createdAt', 'userId']);
          newApp.name.should.eql(app.name);
          newApp.userId.should.eql(user.id);
          const updatedApp = {
            name: 'test-app-updated',
          };
          return Promise.all([updatedApp, applicationService.update(app.id, updatedApp)]);
        })
        .then(([updatedApp, res]) => {
          res.should.eql(true);
          return applicationService.get(app.id).then(_app => {
            should.exist(_app);
            should(_app).have.properties(['id', 'name', 'createdAt', 'updatedAt']);
            _app.id.should.eql(app.id);
            _app.name.should.eql(updatedApp.name);
            _app.createdAt.should.eql(app.createdAt);
          });
        });
    });

    it('should throw an error when updating an app with invalid properties', () => {
      const updatedApp = { invalid: 'someVal' };

      return should(applicationService.update(app.id, updatedApp)).be.rejectedWith(
        'one or more properties is invalid'
      );
    });
  });

  describe('activate/deactivate application tests', () => {
    let user, app;

    before(() => db.flushdb());

    it('should deactivate an application', () => {
      const _user = createRandomUserObject();

      return userService
        .insert(_user)
        .then(newUser => {
          user = newUser;
          should.exist(user.id);
          app = {
            name: 'test-app-1',
          };

          return applicationService.insert(app, user.id);
        })
        .then(newApp => {
          app = newApp;
          should.exist(newApp);
          should(newApp).have.properties(['id', 'name', 'createdAt', 'userId']);
          newApp.name.should.eql(app.name);
          newApp.userId.should.eql(user.id);
          return applicationService.deactivate(app.id);
        })
        .then(res => {
          res.should.eql(true);
          return applicationService.get(app.id);
        })
        .then(_app => {
          should.exist(_app);
          should(_app).have.properties(['id', 'isActive', 'name', 'createdAt', 'updatedAt']);
          _app.id.should.eql(app.id);
          _app.isActive.should.eql(false);
          _app.name.should.eql(app.name);
          _app.createdAt.should.eql(app.createdAt);
        });
    });

    it('should reactivate an application', () => {
      return applicationService
        .activate(app.id)
        .then(res => {
          res.should.eql(true);
          return applicationService.get(app.id);
        })
        .then(_app => {
          should.exist(_app);
          should(_app).have.properties(['id', 'isActive', 'name', 'createdAt', 'updatedAt']);
          _app.id.should.eql(app.id);
          _app.isActive.should.eql(true);
          _app.name.should.eql(app.name);
          _app.createdAt.should.eql(app.createdAt);
        });
    });

    it('should cascade deactivate app upon deactivating user', () => {
      let user1;
      let app1 = {
        name: 'test-app-1',
      };

      let app2 = {
        name: 'test-app-2',
      };

      return userService
        .insert(createRandomUserObject())
        .then(newUser => {
          should.exist(newUser);
          user1 = newUser;
          return applicationService.insert(app1, user1.id);
        })
        .then(newApp => {
          should.exist(newApp);
          app1 = newApp;
          return applicationService.insert(app2, user1.id).then(newApp => {
            should.exist(newApp);
            app2 = newApp;
          });
        })
        .then(() => {
          return userService.deactivate(user1.id).then(success => {
            should.exist(success);
          });
        })
        .then(() => {
          return applicationService.get(app1.id).then(_app => {
            should.exist(_app);
            _app.isActive.should.eql(false);
          });
        })
        .then(() => {
          return applicationService.get(app2.id).then(_app => {
            should.exist(_app);
            _app.isActive.should.eql(false);
          });
        });
    });
  });

  describe('Delete app tests', () => {
    let user, app;

    before(() => {
      const _user = createRandomUserObject();
      return db
        .flushdb()
        .then(() => userService.insert(_user))
        .then(newUser => {
          should.exist(newUser);
          user = newUser;
          app = {
            name: 'test-app',
          };
          return applicationService.insert(app, user.id);
        })
        .then(newApp => {
          should.exist(newApp);
          app = newApp;
        });
    });

    it('should delete app', () => {
      return applicationService.remove(app.id).then(deleted => {
        should.exist(deleted);
        deleted.should.eql(true);
      });
    });

    it('should not get deleted app', () => {
      return applicationService.get(app.id).then(_app => {
        should.exist(_app);
        _app.should.eql(false);
      });
    });

    it('should not delete app with invalid id', () => {
      return should(applicationService.remove('invalid_id')).be.rejected();
    });

    it('should delete all apps belonging to a user', () => {
      let user1, app1, app2;

      return userService
        .insert(createRandomUserObject())
        .then(newUser => {
          should.exist(newUser);
          user1 = newUser;
          app1 = {
            name: 'test-app-1',
          };
          return applicationService.insert(app1, user1.id).then(newApp => {
            should.exist(newApp);
            app1 = newApp;
          });
        })
        .then(() => {
          app2 = {
            name: 'test-app-2',
          };
          return applicationService.insert(app2, user1.id).then(newApp => {
            should.exist(newApp);
            app2 = newApp;
          });
        })
        .then(() => {
          return applicationService.removeAll(user1.id).then(deleted => {
            should.exist(deleted);
            deleted.should.eql(true);
          });
        })
        .then(() => {
          return applicationService.get(app1.id).then(_app => {
            should.exist(_app);
            _app.should.eql(false);
          });
        })
        .then(() => {
          return applicationService.get(app2.id).then(_app => {
            should.exist(_app);
            _app.should.eql(false);
          });
        });
    });

    it('should cascade delete app upon deleting user', () => {
      let user1, app1;

      return userService
        .insert(createRandomUserObject())
        .then(newUser => {
          should.exist(newUser);
          user1 = newUser;
          app1 = {
            name: 'test-app-1',
          };
          return applicationService.insert(app1, user1.id).then(newApp => {
            should.exist(newApp);
            app1 = newApp;
            return app1;
          });
        })
        .then(() => {
          return userService.remove(user1.id).then(deleted => {
            should.exist(deleted);
          });
        })
        .then(() => {
          return applicationService.get(app1.id).then(_app => {
            should.exist(_app);
            _app.should.eql(false);
          });
        });
    });
  });
});

function createRandomUserObject() {
  return {
    username: uuid.v4(),
    firstname: uuid.v4(),
    lastname: uuid.v4(),
    email: `${uuid.v4()}@hello.it`,
  };
}
