const express = require("express");
const config = require("../../core/config");
const oauth2 = require("../../../core/policies/oauth2/oauth2-routes");
require("../../../core/policies/oauth2/oauth2");
require("../../../core/policies/basic-auth/basic-auth");

const app = express();
module.exports = oauth2(app, config);
