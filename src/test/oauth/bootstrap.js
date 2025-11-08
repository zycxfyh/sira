const express = require('express');
const config = require('../../src/core/config');
const oauth2 = require('../../../src/core/policies/oauth2/oauth2-routes');
require('../../../src/core/policies/oauth2/oauth2');
require('../../../src/core/policies/basic-auth/basic-auth');

const app = express();
module.exports = oauth2(app, config);
