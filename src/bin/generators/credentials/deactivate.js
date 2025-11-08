const eg = require('../../eg');
module.exports = class extends eg.Generator {
  constructor(args, opts) {
    super(args, opts);

    this.configureCommand({
      command: 'deactivate [options] <id|keyid..>',
      desc: 'Deactivates a credential by id or keyid',
      builder: yargs =>
        yargs
          .usage(`Usage: $0 ${process.argv[2]} deactivate [options] <id|keyid..>`)
          .string(['t'])
          .alias('t', 'type')
          .demandOption(['t'])
          .nargs('t', 1)
          .describe('t', 'Type of credential: can be one of: oauth2, basic-auth, key-auth')
          .positional('id', { type: 'string' }),
    });
  }

  prompting() {
    const { argv } = this;
    return this.admin.credentials
      .deactivate(argv.id, argv.t)
      .then(res => {
        const { status } = res;

        if (status) {
          if (argv.q) {
            this.stdout(argv.id);
          } else {
            this.log.ok(`${status} ${argv.id}`);
          }
        }
      })
      .catch(err => {
        this.log.error(err.message);
      });
  }
};
