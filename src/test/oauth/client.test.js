const session = require('supertest-session');
const should = require('should');

const app = require('./bootstrap');
const { checkTokenResponse, createOAuthScenario } = require('./testUtils');
const services = require('../../../src/core/services');

const tokenService = services.token;

describe('Functional Test Client Credentials grant', () => {
  let fromDbApp;

  before(() =>
    createOAuthScenario().then(([user, app]) => {
      fromDbApp = app;
    })
  );

  it('should grant access token for requests without scopes', done => {
    const request = session(app);

    request
      .post('/oauth2/token')
      .send({
        grant_type: 'client_credentials',
        client_id: fromDbApp.id,
        client_secret: 'app-secret',
      })
      .expect(200)
      .end((err, res) => {
        if (err) return done(err);
        checkTokenResponse(res.body);
        done();
      });
  });

  it('should grant access token for requests with authorized scopes', done => {
    const request = session(app);

    request
      .post('/oauth2/token')
      .send({
        grant_type: 'client_credentials',
        client_id: fromDbApp.id,
        client_secret: 'app-secret',
        scope: 'someScope',
      })
      .expect(200)
      .end((err, res) => {
        should.not.exist(err);
        checkTokenResponse(res.body);
        tokenService.get(res.body.access_token).then(token => {
          should.exist(token);
          token.scopes.should.eql(['someScope']);
          [token.id, token.tokenDecrypted].should.eql(res.body.access_token.split('|'));
          done();
        });
      });
  });

  it('should not grant access token for requests with unauthorized scopes', done => {
    const request = session(app);

    request
      .post('/oauth2/token')
      .send({
        grant_type: 'client_credentials',
        client_id: fromDbApp.id,
        client_secret: 'app-secret',
        scope: 'someScope unauthorizedScope',
      })
      .expect(401)
      .end(done);
  });
});
