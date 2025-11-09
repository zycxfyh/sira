const _url = require("node:url");

module.exports = class StaticProxy {
  constructor(proxyOptions, endpoints) {
    this.proxyOptions = proxyOptions;
    this.endpoints = endpoints;
    const parsedUrl = new URL(this.endpoints[0]);
    this.target = {
      protocol: parsedUrl.protocol,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      pathname: parsedUrl.pathname,
      search: parsedUrl.search,
      hash: parsedUrl.hash,
    };
  }

  nextTarget() {
    return Object.assign({}, this.proxyOptions.target, this.target);
  }
};
