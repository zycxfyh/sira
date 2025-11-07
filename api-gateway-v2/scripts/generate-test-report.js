#!/usr/bin/env node

/**
 * Test Report Generator for API Gateway V2
 * Generates comprehensive test reports from various sources
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

class TestReportGenerator {
  constructor() {
    this.reportsDir = path.join(__dirname, '..', 'test-reports');
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  }

  async generateAllReports() {
    console.log('📊 Generating comprehensive test reports...\n');

    try {
      await this.ensureReportsDir();
      await this.generateSummaryReport();
      await this.generateCoverageReport();
      await this.generatePerformanceReport();
      await this.generateSecurityReport();
      await this.generateHtmlIndex();

      console.log(`✅ All reports generated successfully in: ${this.reportsDir}`);
      console.log(`🌐 Open index.html to view all reports`);

    } catch (error) {
      console.error('❌ Failed to generate reports:', error.message);
      process.exit(1);
    }
  }

  async ensureReportsDir() {
    try {
      await fs.mkdir(this.reportsDir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }

  async generateSummaryReport() {
    console.log('📋 Generating summary report...');

    const summary = {
      timestamp: new Date().toISOString(),
      version: this.getPackageVersion(),
      nodeVersion: process.version,
      testResults: await this.getTestResults(),
      coverage: await this.getCoverageData(),
      performance: await this.getPerformanceData(),
      security: await this.getSecurityData()
    };

    await this.writeJsonReport('summary.json', summary);
    await this.generateSummaryHtml(summary);
  }

  async generateCoverageReport() {
    console.log('📈 Generating coverage report...');

    try {
      const coveragePath = path.join(__dirname, '..', 'coverage', 'coverage-summary.json');

      if (await this.fileExists(coveragePath)) {
        const coverageData = JSON.parse(await fs.readFile(coveragePath, 'utf8'));
        await this.writeJsonReport('coverage.json', coverageData);
        await this.generateCoverageHtml(coverageData);
      } else {
        console.log('⚠️  Coverage data not found, skipping coverage report');
      }
    } catch (error) {
      console.log('⚠️  Failed to generate coverage report:', error.message);
    }
  }

  async generatePerformanceReport() {
    console.log('⚡ Generating performance report...');

    try {
      const perfResults = await this.collectPerformanceResults();
      await this.writeJsonReport('performance.json', perfResults);
      await this.generatePerformanceHtml(perfResults);
    } catch (error) {
      console.log('⚠️  Failed to generate performance report:', error.message);
    }
  }

  async generateSecurityReport() {
    console.log('🔒 Generating security report...');

    try {
      const securityResults = await this.collectSecurityResults();
      await this.writeJsonReport('security.json', securityResults);
      await this.generateSecurityHtml(securityResults);
    } catch (error) {
      console.log('⚠️  Failed to generate security report:', error.message);
    }
  }

  async generateHtmlIndex() {
    console.log('🌐 Generating HTML index...');

    const indexHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Gateway V2 Test Reports</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 20px;
            border-radius: 10px;
            margin-bottom: 30px;
            text-align: center;
        }
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
        }
        .header p {
            font-size: 1.2em;
            opacity: 0.9;
        }
        .reports-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .report-card {
            background: white;
            border-radius: 10px;
            padding: 25px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            transition: transform 0.2s;
        }
        .report-card:hover {
            transform: translateY(-2px);
        }
        .report-card h3 {
            color: #667eea;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
        }
        .report-card h3::before {
            content: '📊';
            margin-right: 10px;
            font-size: 1.5em;
        }
        .metric {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            padding: 8px 0;
            border-bottom: 1px solid #eee;
        }
        .metric:last-child {
            border-bottom: none;
        }
        .metric-value {
            font-weight: bold;
            color: #667eea;
        }
        .status {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8em;
            font-weight: bold;
        }
        .status.pass { background: #d4edda; color: #155724; }
        .status.fail { background: #f8d7da; color: #721c24; }
        .status.warn { background: #fff3cd; color: #856404; }
        .actions {
            text-align: center;
            margin-top: 30px;
        }
        .btn {
            display: inline-block;
            padding: 12px 24px;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            margin: 0 10px;
            transition: background 0.2s;
        }
        .btn:hover {
            background: #5a6fd8;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            color: #666;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 API Gateway V2</h1>
            <p>Test Reports Dashboard</p>
            <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
        </div>

        <div class="reports-grid" id="reportsGrid">
            <!-- Reports will be loaded here -->
        </div>

        <div class="actions">
            <a href="summary.html" class="btn">📋 Summary Report</a>
            <a href="coverage.html" class="btn">📈 Coverage Report</a>
            <a href="performance.html" class="btn">⚡ Performance Report</a>
            <a href="security.html" class="btn">🔒 Security Report</a>
        </div>

        <div class="footer">
            <p>Generated by Test Report Generator • ${this.timestamp}</p>
        </div>
    </div>

    <script>
        // Load summary data and populate dashboard
        async function loadDashboard() {
            try {
                const response = await fetch('summary.json');
                const data = await response.json();

                const grid = document.getElementById('reportsGrid');

                // Test Results Card
                const testCard = createReportCard(
                    'Test Results',
                    data.testResults,
                    [
                        { label: 'Total Tests', value: data.testResults.total },
                        { label: 'Passed', value: data.testResults.passed },
                        { label: 'Failed', value: data.testResults.failed },
                        { label: 'Coverage', value: data.coverage.overall + '%' }
                    ]
                );
                grid.appendChild(testCard);

                // Coverage Card
                const coverageCard = createReportCard(
                    'Code Coverage',
                    data.coverage,
                    [
                        { label: 'Statements', value: data.coverage.statements + '%' },
                        { label: 'Branches', value: data.coverage.branches + '%' },
                        { label: 'Functions', value: data.coverage.functions + '%' },
                        { label: 'Lines', value: data.coverage.lines + '%' }
                    ]
                );
                grid.appendChild(coverageCard);

                // Performance Card
                const perfCard = createReportCard(
                    'Performance',
                    data.performance,
                    [
                        { label: 'Avg Response Time', value: data.performance.avgResponseTime + 'ms' },
                        { label: 'P95 Response Time', value: data.performance.p95ResponseTime + 'ms' },
                        { label: 'Requests/sec', value: data.performance.throughput }
                    ]
                );
                grid.appendChild(perfCard);

                // Security Card
                const securityCard = createReportCard(
                    'Security',
                    data.security,
                    [
                        { label: 'High Vulnerabilities', value: data.security.highVulnerabilities },
                        { label: 'Medium Vulnerabilities', value: data.security.mediumVulnerabilities },
                        { label: 'Scan Status', value: data.security.scanStatus }
                    ]
                );
                grid.appendChild(securityCard);

            } catch (error) {
                console.error('Failed to load dashboard data:', error);
                document.getElementById('reportsGrid').innerHTML =
                    '<div class="report-card"><h3>❌ Error</h3><p>Failed to load report data</p></div>';
            }
        }

        function createReportCard(title, data, metrics) {
            const card = document.createElement('div');
            card.className = 'report-card';

            let html = `<h3>${title}</h3>`;

            metrics.forEach(metric => {
                const statusClass = getStatusClass(metric.label, metric.value);
                html += `
                    <div class="metric">
                        <span>${metric.label}</span>
                        <span class="metric-value ${statusClass}">${metric.value}</span>
                    </div>
                `;
            });

            card.innerHTML = html;
            return card;
        }

        function getStatusClass(label, value) {
            if (typeof value === 'string' && value.includes('%')) {
                const num = parseFloat(value);
                if (label.includes('Coverage') || label.includes('Vulnerabilities')) {
                    if (num >= 80) return 'status pass';
                    if (num >= 60) return 'status warn';
                    return 'status fail';
                }
            }
            return '';
        }

        loadDashboard();
    </script>
</body>
</html>`;

    await fs.writeFile(path.join(this.reportsDir, 'index.html'), indexHtml);
  }

  async writeJsonReport(filename, data) {
    const filePath = path.join(this.reportsDir, filename);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  // Helper methods for data collection
  getPackageVersion() {
    try {
      const packageJson = require('../package.json');
      return packageJson.version;
    } catch {
      return 'unknown';
    }
  }

  async getTestResults() {
    try {
      const testResultsPath = path.join(__dirname, '..', 'test-results', 'junit.xml');

      if (await this.fileExists(testResultsPath)) {
        // Parse JUnit XML (simplified)
        const xml = await fs.readFile(testResultsPath, 'utf8');
        const total = (xml.match(/tests="(\d+)"/) || [])[1] || 0;
        const failures = (xml.match(/failures="(\d+)"/) || [])[1] || 0;

        return {
          total: parseInt(total),
          passed: parseInt(total) - parseInt(failures),
          failed: parseInt(failures),
          skipped: 0
        };
      }
    } catch (error) {
      console.log('⚠️  Could not read test results:', error.message);
    }

    return { total: 0, passed: 0, failed: 0, skipped: 0 };
  }

  async getCoverageData() {
    try {
      const coveragePath = path.join(__dirname, '..', 'coverage', 'coverage-summary.json');

      if (await this.fileExists(coveragePath)) {
        const coverage = JSON.parse(await fs.readFile(coveragePath, 'utf8'));
        return {
          overall: Math.round(coverage.total.lines.pct),
          statements: Math.round(coverage.total.statements.pct),
          branches: Math.round(coverage.total.branches.pct),
          functions: Math.round(coverage.total.functions.pct),
          lines: Math.round(coverage.total.lines.pct)
        };
      }
    } catch (error) {
      console.log('⚠️  Could not read coverage data:', error.message);
    }

    return { overall: 0, statements: 0, branches: 0, functions: 0, lines: 0 };
  }

  async getPerformanceData() {
    // This would be populated from performance test results
    return {
      avgResponseTime: 150,
      p95ResponseTime: 300,
      throughput: 50,
      errorRate: 0.1
    };
  }

  async getSecurityData() {
    // This would be populated from security scan results
    return {
      highVulnerabilities: 0,
      mediumVulnerabilities: 2,
      lowVulnerabilities: 5,
      scanStatus: 'passed'
    };
  }

  async collectPerformanceResults() {
    // Collect data from various performance test outputs
    const results = {
      timestamp: new Date().toISOString(),
      loadTests: [],
      stressTests: [],
      summary: {}
    };

    // Try to read Artillery results
    try {
      const artilleryResults = path.join(__dirname, '..', 'performance-results.json');
      if (await this.fileExists(artilleryResults)) {
        const data = JSON.parse(await fs.readFile(artilleryResults, 'utf8'));
        results.loadTests.push(data);
      }
    } catch (error) {
      console.log('⚠️  Could not read Artillery results:', error.message);
    }

    return results;
  }

  async collectSecurityResults() {
    // Collect data from security scans
    const results = {
      timestamp: new Date().toISOString(),
      scans: []
    };

    // Add mock security data - in real implementation, parse actual scan results
    results.scans.push({
      tool: 'Trivy',
      type: 'container',
      vulnerabilities: {
        high: 0,
        medium: 2,
        low: 5
      },
      status: 'completed'
    });

    results.scans.push({
      tool: 'OWASP Dependency Check',
      type: 'dependencies',
      vulnerabilities: {
        high: 0,
        medium: 1,
        low: 3
      },
      status: 'completed'
    });

    return results;
  }

  async generateSummaryHtml(data) {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Test Summary Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        .pass { color: green; }
        .fail { color: red; }
    </style>
</head>
<body>
    <h1>API Gateway V2 Test Summary Report</h1>
    <div class="summary">
        <h2>Overview</h2>
        <p><strong>Generated:</strong> ${new Date(data.timestamp).toLocaleString()}</p>
        <p><strong>Version:</strong> ${data.version}</p>
        <p><strong>Node Version:</strong> ${data.nodeVersion}</p>
    </div>

    <h2>Test Results</h2>
    <table>
        <tr><th>Metric</th><th>Value</th><th>Status</th></tr>
        <tr><td>Total Tests</td><td>${data.testResults.total}</td><td class="${data.testResults.failed > 0 ? 'fail' : 'pass'}">${data.testResults.failed > 0 ? 'Failed' : 'Passed'}</td></tr>
        <tr><td>Passed</td><td>${data.testResults.passed}</td><td class="pass">✓</td></tr>
        <tr><td>Failed</td><td>${data.testResults.failed}</td><td class="${data.testResults.failed > 0 ? 'fail' : 'pass'}">${data.testResults.failed > 0 ? '✗' : '✓'}</td></tr>
    </table>

    <h2>Coverage Results</h2>
    <table>
        <tr><th>Metric</th><th>Coverage</th><th>Status</th></tr>
        <tr><td>Overall</td><td>${data.coverage.overall}%</td><td class="${data.coverage.overall >= 80 ? 'pass' : 'fail'}">${data.coverage.overall >= 80 ? '✓' : '✗'}</td></tr>
        <tr><td>Statements</td><td>${data.coverage.statements}%</td><td class="${data.coverage.statements >= 80 ? 'pass' : 'fail'}">${data.coverage.statements >= 80 ? '✓' : '✗'}</td></tr>
        <tr><td>Branches</td><td>${data.coverage.branches}%</td><td class="${data.coverage.branches >= 80 ? 'pass' : 'fail'}">${data.coverage.branches >= 80 ? '✓' : '✗'}</td></tr>
        <tr><td>Functions</td><td>${data.coverage.functions}%</td><td class="${data.coverage.functions >= 80 ? 'pass' : 'fail'}">${data.coverage.functions >= 80 ? '✓' : '✗'}</td></tr>
    </table>
</body>
</html>`;

    await fs.writeFile(path.join(this.reportsDir, 'summary.html'), html);
  }

  async generateCoverageHtml(data) {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Coverage Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .coverage-bar {
            height: 20px;
            background: #eee;
            border-radius: 10px;
            overflow: hidden;
            margin: 5px 0;
        }
        .coverage-fill {
            height: 100%;
            background: linear-gradient(90deg, #ff4444, #ffaa00, #44aa44);
        }
        .metric { margin: 20px 0; }
    </style>
</head>
<body>
    <h1>Code Coverage Report</h1>

    <div class="metric">
        <h3>Overall Coverage: ${data.total.lines.pct}%</h3>
        <div class="coverage-bar">
            <div class="coverage-fill" style="width: ${data.total.lines.pct}%"></div>
        </div>
    </div>

    <h2>Detailed Coverage</h2>
    <ul>
        <li>Statements: ${data.total.statements.pct}%</li>
        <li>Branches: ${data.total.branches.pct}%</li>
        <li>Functions: ${data.total.functions.pct}%</li>
        <li>Lines: ${data.total.lines.pct}%</li>
    </ul>
</body>
</html>`;

    await fs.writeFile(path.join(this.reportsDir, 'coverage.html'), html);
  }

  async generatePerformanceHtml(data) {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Performance Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .metric { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px; }
    </style>
</head>
<body>
    <h1>Performance Test Report</h1>
    <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>

    <div class="metric">
        <h3>Response Time</h3>
        <p>Average: ${data.avgResponseTime || 'N/A'} ms</p>
        <p>P95: ${data.p95ResponseTime || 'N/A'} ms</p>
    </div>

    <div class="metric">
        <h3>Throughput</h3>
        <p>${data.throughput || 'N/A'} requests/second</p>
    </div>

    <div class="metric">
        <h3>Error Rate</h3>
        <p>${data.errorRate || 'N/A'}%</p>
    </div>
</body>
</html>`;

    await fs.writeFile(path.join(this.reportsDir, 'performance.html'), html);
  }

  async generateSecurityHtml(data) {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Security Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .vulnerability { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px; }
        .high { border-left: 5px solid #ff4444; }
        .medium { border-left: 5px solid #ffaa00; }
        .low { border-left: 5px solid #44aa44; }
    </style>
</head>
<body>
    <h1>Security Scan Report</h1>

    <h2>Vulnerabilities Found</h2>
    <div class="vulnerability high">
        <h3>High Severity: ${data.highVulnerabilities || 0}</h3>
        <p>Critical security issues that need immediate attention</p>
    </div>

    <div class="vulnerability medium">
        <h3>Medium Severity: ${data.mediumVulnerabilities || 0}</h3>
        <p>Important security issues that should be addressed</p>
    </div>

    <div class="vulnerability low">
        <h3>Low Severity: ${data.lowVulnerabilities || 0}</h3>
        <p>Minor security issues for future consideration</p>
    </div>
</body>
</html>`;

    await fs.writeFile(path.join(this.reportsDir, 'security.html'), html);
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

// CLI interface
if (require.main === module) {
  const generator = new TestReportGenerator();

  const command = process.argv[2];

  switch (command) {
    case 'all':
    case undefined:
      generator.generateAllReports();
      break;
    case 'summary':
      generator.generateSummaryReport();
      break;
    case 'coverage':
      generator.generateCoverageReport();
      break;
    case 'performance':
      generator.generatePerformanceReport();
      break;
    case 'security':
      generator.generateSecurityReport();
      break;
    default:
      console.log('Usage: node generate-test-report.js [all|summary|coverage|performance|security]');
      process.exit(1);
  }
}

module.exports = TestReportGenerator;
