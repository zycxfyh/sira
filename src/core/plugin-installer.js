const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const util = require("node:util");
const YAWN = require("yawn-yaml/cjs");
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

class PluginInstaller {
  constructor(options) {
    options = options || {};
    this.packageName = options.packageName || null;
    this.pluginManifest = options.pluginManifest || null;
    this.config = options.config;
  }

  static get PACKAGE_PREFIX() {
    return "express-gateway-plugin-";
  }

  static create(options) {
    return new PluginInstaller(options);
  }

  _isPackageSpecifierSafe(packageSpecifier) {
    // SECURITY: Disable local plugin installation in production
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "SECURITY: Local plugin installation is disabled in production environment",
      );
      // Only allow official packages in production
      return (
        packageSpecifier.startsWith("@express-gateway/") ||
        packageSpecifier.startsWith("express-gateway-plugin-")
      );
    }

    // Only allow official @express-gateway scoped packages
    if (packageSpecifier.startsWith("@express-gateway/")) {
      return true;
    }

    // Allow express-gateway-plugin-* packages
    if (packageSpecifier.startsWith("express-gateway-plugin-")) {
      return true;
    }

    // Allow local file paths for development (restrict to plugins-dev directory only)
    if (
      packageSpecifier.startsWith("./") ||
      packageSpecifier.startsWith("../")
    ) {
      const resolvedPath = require("node:path").resolve(packageSpecifier);
      const projectRoot = require("node:path").resolve(process.cwd());
      const allowedPluginDir = path.join(projectRoot, "plugins-dev");

      // Only allow paths within the dedicated plugins-dev directory
      if (
        resolvedPath.startsWith(allowedPluginDir + path.sep) ||
        resolvedPath === allowedPluginDir
      ) {
        // Additional check: ensure the directory exists and contains a valid plugin
        try {
          const stats = fs.statSync(resolvedPath);
          if (stats.isDirectory()) {
            // Check if there's a package.json file (indicates a valid plugin)
            const packageJsonPath = path.join(resolvedPath, "package.json");
            if (fs.existsSync(packageJsonPath)) {
              // Additional security: verify package.json contains expected fields
              const packageJson = JSON.parse(
                fs.readFileSync(packageJsonPath, "utf8"),
              );
              return packageJson.name?.startsWith("express-gateway-plugin-");
            }
          }
        } catch (_error) {
          // Path doesn't exist, can't be accessed, or package.json is invalid
          return false;
        }
      }
    }

    // Block all other package specifiers for security
    return false;
  }

  runNPMInstallation({ packageSpecifier, cwd, env }) {
    return new Promise((resolve, reject) => {
      // SECURITY: Validate package specifier before installation
      if (!this._isPackageSpecifierSafe(packageSpecifier)) {
        reject(
          new Error(
            `Unsafe package specifier: ${packageSpecifier}. Only official @express-gateway scoped packages are allowed.`,
          ),
        );
        return;
      }

      // manually spawn npm
      // use --parseable flag to get tab-delimited output
      // forward sterr to process.stderr
      // capture stdout to get package name

      let pluginPath = null;

      const installArgs = [
        "install",
        packageSpecifier,
        "--cache-min",
        24 * 60 * 60,
        "--parseable",
        "--save",
      ];

      const installOpts = {
        cwd: cwd || process.cwd(),
        env: env || process.env,
        stdio: ["ignore", "pipe", "inherit"],
      };

      const npmCommand = os.platform() === "win32" ? "npm.cmd" : "npm";
      const npmInstall = spawn(npmCommand, installArgs, installOpts);

      npmInstall.on("error", (_) => {
        reject(new Error("Cannot install", packageSpecifier));
      });

      const bufs = [];
      let len = 0;
      npmInstall.stdout.on("readable", () => {
        const buf = npmInstall.stdout.read();

        if (buf) {
          bufs.push(buf);
          len += buf.length;
        }
      });

      npmInstall.stdout.on("end", () => {
        const lines = Buffer.concat(bufs, len).toString().trim().split("\n");

        const line = lines[lines.length - 1];

        if (line.indexOf("\t") > -1) {
          // npm >= 5
          const output = lines[lines.length - 1].split("\t");

          if (output.length < 4) {
            reject(
              new Error("Cannot parse npm output while installing plugin."),
            );
            return;
          }

          this.packageName = output[1];
          pluginPath = path.join(cwd, output[3]);
        } else {
          // npm < 5
          this.packageName = path.basename(line);
          pluginPath = line;
        }
      });

      npmInstall.on("exit", () => {
        if (pluginPath) {
          this.pluginManifest = require(pluginPath);

          resolve({
            packageName: this.packageName,
            pluginManifest: this.pluginManifest,
          });
        }
      });
    });
  }

  get existingPluginOptions() {
    const config = this.config || require("./config");
    const { systemConfig } = config;

    const name = this.pluginKey;

    const existingPluginOptions = systemConfig.plugins?.[name]
      ? systemConfig.plugins[name]
      : {};

    return existingPluginOptions;
  }

  get pluginKey() {
    let name = this.pluginManifest.name || this.packageName;

    if (
      !this.pluginManifest.name &&
      this.packageName.startsWith(PluginInstaller.PACKAGE_PREFIX)
    ) {
      name = this.packageName.substr(PluginInstaller.PACKAGE_PREFIX.length);
    }

    return name;
  }

  updateConfigurationFiles({
    pluginOptions,
    enablePlugin,
    addPoliciesToWhitelist,
  }) {
    // WARNING (kevinswiber): Updating YAML while maintaining presentation
    // style is not easy.  We're using the YAWN library here, which has
    // a decent approach given the current state of available YAML parsers,
    // but it's far from perfect.  Take a look at existing YAWN issues
    // before making any optimizations.  If any section of this code looks
    // ugly or inefficient, it may be that way for a reason (or maybe not).
    //
    // ¯\_(ツ)_/¯
    //
    // https://github.com/mohsen1/yawn-yaml/issues

    // SECURITY: Runtime configuration modification is dangerous in production
    if (process.env.NODE_ENV === "production") {
      return Promise.reject(
        new Error(
          "Runtime plugin installation and configuration modification is DISABLED in production for security reasons. Use deployment pipelines instead.",
        ),
      );
    }

    if (!this.pluginManifest) {
      return Promise.reject(
        new Error("Configuration files require a plugin manifest."),
      );
    }

    let name = this.pluginManifest.name || this.packageName;

    if (
      !this.pluginManifest.name &&
      this.packageName.startsWith(PluginInstaller.PACKAGE_PREFIX)
    ) {
      name = this.packageName.substr(PluginInstaller.PACKAGE_PREFIX.length);
    }

    const maybeWriteSystemConfig = () => {
      if (enablePlugin) {
        return this._generateSystemConfigData(name, pluginOptions).then(
          ({ systemConfigPath, output }) => writeFile(systemConfigPath, output),
        );
      }

      return Promise.resolve();
    };

    const maybeWriteGatewayConfig = () => {
      if (addPoliciesToWhitelist) {
        const policyNames = this.pluginManifest.policies || [];

        return this._generateGatewayConfigData(policyNames).then(
          ({ gatewayConfigPath, output }) =>
            writeFile(gatewayConfigPath, output),
        );
      }

      return Promise.resolve();
    };

    return maybeWriteSystemConfig().then(maybeWriteGatewayConfig);
  }

  _updateYAML(obj, yawn) {
    yawn.json = obj;
    return yawn.json;
  }

  _generateSystemConfigData(name, pluginOptions) {
    const config = this.config || require("./config");
    const isJSON = config.systemConfigPath.toLowerCase().endsWith(".json");
    const isYAML = !isJSON;

    return readFile(config.systemConfigPath).then((systemConfig) => {
      // YAML-specific variables
      let yawn = null;
      let oldLength = null;

      let obj = null;

      if (isYAML) {
        yawn = new YAWN(systemConfig.toString());
        obj = Object.assign({}, yawn.json);

        oldLength = obj.plugins ? null : yawn.yaml.length;
      } else {
        obj = JSON.parse(systemConfig.toString());
      }

      let plugins = obj.plugins || {};

      if (!Object.hasOwn(plugins, name)) {
        plugins[name] = {};
      }

      plugins[name].package = this.packageName;
      obj.plugins = plugins;

      if (isYAML) {
        obj = this._updateYAML(obj, yawn);
      }

      if (pluginOptions) {
        // YAWN needs to be updated by smallest atomic unit
        Object.keys(pluginOptions).forEach((key) => {
          plugins[name][key] = pluginOptions[key];
          obj.plugins = plugins;

          if (isYAML) {
            obj = this._updateYAML(obj, yawn);
            plugins = obj.plugins;
          }
        });
      }

      if (isYAML && oldLength) {
        // add a line break before inserting a new plugins mapping
        yawn.yaml =
          yawn.yaml.substr(0, oldLength - 1) +
          os.EOL +
          yawn.yaml.substr(oldLength - 1);
      }

      const output = isYAML ? yawn.yaml.trim() : JSON.stringify(obj, null, 2);

      return {
        systemConfigPath: config.systemConfigPath,
        output,
      };
    });
  }

  _generateGatewayConfigData(policyNames) {
    const config = this.config || require("./config");
    const isJSON = config.gatewayConfigPath.toLowerCase().endsWith(".json");
    const isYAML = !isJSON;

    return readFile(config.gatewayConfigPath).then((gatewayConfig) => {
      // YAML-specific variable
      let yawn = null;

      let obj = null;

      if (isYAML) {
        yawn = new YAWN(gatewayConfig.toString());
        obj = Object.assign({}, yawn.json);
      } else {
        obj = JSON.parse(gatewayConfig.toString());
      }

      const policies = obj.policies || [];

      // YAWN reverses arrays.  ¯\_(ツ)_/¯
      const correctedPolicyNames = isYAML ? policyNames.reverse() : policyNames;

      correctedPolicyNames.forEach((policy) => {
        if (policies.indexOf(policy) === -1) {
          policies.push(policy);
        }
      });

      obj.policies = policies;

      if (isYAML) {
        yawn.json = obj;
      }

      const output = isYAML ? yawn.yaml.trim() : JSON.stringify(obj, null, 2);

      return {
        gatewayConfigPath: config.gatewayConfigPath,
        output,
      };
    });
  }
}

module.exports = PluginInstaller;
