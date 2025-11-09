const rest = require("../../../core/rest");
const adminClient = require("../../admin");
module.exports = () => ({
  start({ config } = {}) {
    return rest({ config }).then((srv) => {
      this.adminSrv = srv;
      const srvInfo = srv.address();
      this.admin = adminClient({
        baseUrl: `http://${srvInfo.address}:${srvInfo.port}`,
      });
      return this.adminSrv;
    });
  },
  stop() {
    this.adminSrv?.close();
    return this.reset();
  },
  reset() {
    const db = require("../../../core/db");
    return db.flushdb();
  },
});
