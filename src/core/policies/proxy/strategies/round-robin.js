const _url = require("node:url");

module.exports = class RoundRobin {
  constructor(proxyOptions, endpoints) {
    this.proxyOptions = proxyOptions;
    this.endpoints = endpoints;
    this.endpointIndex = 0;
    this.endpointMaxIndex = this.endpoints.length - 1;
  }

  nextTarget() {
    const target = this.endpoints[this.endpointIndex++];

    if (this.endpointIndex > this.endpointMaxIndex) {
      this.endpointIndex = 0;
    }

    const parsedUrl = new URL(target);
    return Object.assign({}, this.proxyOptions.target, {
      protocol: parsedUrl.protocol,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      pathname: parsedUrl.pathname,
      search: parsedUrl.search,
      hash: parsedUrl.hash,
    });
  }
};
