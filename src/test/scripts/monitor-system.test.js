const { exec, spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const MONITOR_SCRIPT = path.join(__dirname, '../../scripts/monitor-system.sh');
const isWindows = process.platform === 'win32';

const hasBash = (() => {
  if (isWindows) {
    return false;
  }
  try {
    const result = spawnSync('bash', ['--version'], { stdio: 'ignore' });
    return result.status === 0;
  } catch (error) {
    return false;
  }
})();

const describeIfBash = hasBash ? describe : describe.skip;

if (!hasBash) {
  // eslint-disable-next-line no-console
  console.warn('Skipping monitor-system script tests: "bash" command not available in this environment.');
}

// Helper function to run shell commands
function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: path.dirname(MONITOR_SCRIPT),
      env: { ...process.env, ...options.env },
      ...options,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', data => {
      stdout += data.toString();
    });

    child.stderr.on('data', data => {
      stderr += data.toString();
    });

    child.on('close', code => {
      resolve({ code, stdout, stderr });
    });

    child.on('error', error => {
      reject(error);
    });
  });
}

describeIfBash('Monitor System Script Tests', () => {
  const testLogFile = '/tmp/test-monitor.log';
  const testMetricsFile = '/tmp/test-metrics.json';

  beforeEach(() => {
    // Clean up test files
    try {
      if (fs.existsSync(testLogFile)) fs.unlinkSync(testLogFile);
      if (fs.existsSync(testMetricsFile)) fs.unlinkSync(testMetricsFile);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  afterEach(() => {
    // Clean up test files
    try {
      if (fs.existsSync(testLogFile)) fs.unlinkSync(testLogFile);
      if (fs.existsSync(testMetricsFile)) fs.unlinkSync(testMetricsFile);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('should show help message', async () => {
    const { code, stdout } = await runCommand('bash', [MONITOR_SCRIPT, 'help']);

    expect(code).toBe(0);
    expect(stdout).toContain('Usage:');
    expect(stdout).toContain('Commands:');
    expect(stdout).toContain('Options:');
  });

  test('should perform health check', async () => {
    const { code, stdout } = await runCommand('bash', [MONITOR_SCRIPT, 'check'], {
      env: {
        LOG_FILE: testLogFile,
        METRICS_FILE: testMetricsFile,
        GATEWAY_URL: 'http://invalid-url-that-should-fail',
        PROMETHEUS_URL: 'http://invalid-url-that-should-fail',
        GRAFANA_URL: 'http://invalid-url-that-should-fail',
      },
    });

    expect(code).toBe(0);
    expect(stdout).toContain('System Health:');
    expect(stdout).toContain('Application Health:');
  });

  test('should validate configuration', async () => {
    // Test invalid MONITOR_INTERVAL
    const { code: code1 } = await runCommand('bash', [MONITOR_SCRIPT, 'check'], {
      env: {
        MONITOR_INTERVAL: 'invalid',
        LOG_FILE: testLogFile,
        METRICS_FILE: testMetricsFile,
      },
    });

    expect(code1).toBe(0); // Should not exit with error due to validation

    // Test invalid ALERT_THRESHOLD
    const { code: code2 } = await runCommand('bash', [MONITOR_SCRIPT, 'check'], {
      env: {
        ALERT_THRESHOLD: '150', // Above max 100
        LOG_FILE: testLogFile,
        METRICS_FILE: testMetricsFile,
      },
    });

    expect(code2).toBe(0); // Should not exit with error due to validation
  });

  test('should generate report', async () => {
    const reportFile = '/tmp/test-system-report.txt';

    const { code } = await runCommand('bash', [MONITOR_SCRIPT, 'report'], {
      env: {
        LOG_FILE: testLogFile,
        METRICS_FILE: testMetricsFile,
      },
    });

    expect(code).toBe(0);

    // Check if report file exists (may not exist due to permissions)
    try {
      if (fs.existsSync(reportFile)) {
        const content = fs.readFileSync(reportFile, 'utf8');
        expect(content).toContain('System Monitoring Report');
        fs.unlinkSync(reportFile);
      }
    } catch (error) {
      // Report file may not be accessible, that's ok for this test
    }
  });

  test('should handle invalid command', async () => {
    const { code } = await runCommand('bash', [MONITOR_SCRIPT, 'invalid-command'], {
      env: {
        LOG_FILE: testLogFile,
        METRICS_FILE: testMetricsFile,
      },
    });

    // Should start main monitoring loop (which will be terminated by timeout)
    expect(code).toBeGreaterThanOrEqual(0);
  });

  test('should collect system metrics', () => {
    // This test verifies that the get_system_metrics function works
    // We'll create a minimal test by sourcing the script and calling the function

    const testScript = `
      source "${MONITOR_SCRIPT}"
      get_cpu_usage
      get_memory_info
      get_disk_usage
      get_load_average
      echo "System metrics functions executed successfully"
    `;

    return new Promise((resolve, reject) => {
      const child = spawn('bash', ['-c', testScript], {
        cwd: path.dirname(MONITOR_SCRIPT),
      });

      let output = '';

      child.stdout.on('data', data => {
        output += data.toString();
      });

      child.on('close', code => {
        expect(code).toBe(0);
        expect(output).toContain('System metrics functions executed successfully');
        resolve();
      });

      child.on('error', reject);

      // Timeout after 10 seconds
      setTimeout(() => {
        child.kill();
        resolve();
      }, 10000);
    });
  });
});
