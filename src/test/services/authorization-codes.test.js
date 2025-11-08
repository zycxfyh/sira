const should = require('should');
const services = require('../../../src/core/services');
const authCodeService = services.authorizationCode;
const db = require('../../../src/core/db');

describe('Authorization Code Tests', () => {
  let newCode, codeFromDb;

  before(() => {
    return db.flushdb();
  });

  it('should save a code', done => {
    newCode = {
      consumerId: 'clientId',
      userId: 'userId',
      redirectUri: 'redirectUri',
      scopes: ['scope1', 'scope2'],
    };

    authCodeService
      .save(newCode)
      .then(code => {
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

  it('should find a code', done => {
    const criteria = Object.assign(newCode, { id: codeFromDb.id });

    authCodeService
      .find(criteria)
      .then(code => {
        codeFromDb.should.deepEqual(code);
        done();
      })
      .catch(done);
  });

  it('should not find a code the second time', done => {
    const criteria = Object.assign(newCode, { id: codeFromDb.id });

    authCodeService
      .find(criteria)
      .then(code => {
        should.not.exist(code);
        done();
      })
      .catch(done);
  });
});
