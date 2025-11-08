const should = require('should');
const services = require('../../../src/core/services');
const credentialService = services.credential;
const db = require('../../../src/core/db');

describe('Scope tests', () => {
  before(() => db.flushdb());

  it('should insert a scope', done => {
    credentialService
      .insertScopes(['someScope'])
      .then(res => {
        should.exist(res);
        res.should.eql(true);
        done();
      })
      .catch(err => {
        should.not.exist(err);
        done();
      });
  });

  it('should insert multiple scopes', done => {
    credentialService
      .insertScopes(['someScope1', 'someScope2'])
      .then(res => {
        should.exist(res);
        res.should.eql(true);
        done();
      })
      .catch(err => {
        should.not.exist(err);
        done();
      });
  });

  it('should not insert scope that already exists', done => {
    credentialService
      .insertScopes(['someScope1'])
      .then(res => {
        should.not.exist(res);
        done();
      })
      .catch(err => {
        should.exist(err);
        done();
      });
  });

  it('should not insert a scope which is not a string', done => {
    credentialService
      .insertScopes([{}])
      .then(res => {
        should.not.exist(res);
        done();
      })
      .catch(err => {
        should.exist(err);
        done();
      });
  });

  it('should not insert a scope which is null', done => {
    credentialService
      .insertScopes([null])
      .then(res => {
        should.not.exist(res);
        done();
      })
      .catch(err => {
        should.exist(err);
        done();
      });
  });

  it('should check if scope exists and reply with positive if it does', done => {
    credentialService
      .existsScope('someScope')
      .then(res => {
        should.exist(res);
        res.should.eql(true);
        done();
      })
      .catch(err => {
        should.not.exist(err);
        done();
      });
  });

  it('should check if scope exists and reply with negative if it does not', done => {
    credentialService
      .existsScope('someInvalidScope')
      .then(res => {
        should.exist(res);
        res.should.eql(false);
        done();
      })
      .catch(err => {
        should.not.exist(err);
        done();
      });
  });

  it('should get all scopes', done => {
    credentialService
      .getAllScopes()
      .then(res => {
        should.exist(res);
        res.should.containEql('someScope');
        res.should.containEql('someScope1');
        res.should.containEql('someScope2');
        done();
      })
      .catch(err => {
        should.not.exist(err);
        done();
      });
  });

  it('should remove a scope', done => {
    credentialService
      .removeScopes('someScope')
      .then(res => {
        should.exist(res);
        res.should.eql(true);
        done();
      })
      .catch(err => {
        should.not.exist(err);
        done();
      });
  });

  it('removed scope should no longer exist', done => {
    credentialService
      .existsScope('someScope')
      .then(res => {
        should.exist(res);
        res.should.eql(false);
        done();
      })
      .catch(err => {
        should.not.exist(err);
        done();
      });
  });
});
