// 文件路径: tools/scripts/dev-tools.ts
// 灵感来源: 多个项目的开发工具理念
// 核心理念: 统一的开发工具脚本，提升开发效率

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * @class DevTools
 * @description 开发工具集合
 * 提供测试、覆盖率、代码质量检查等工具
 */
export class DevTools {
  /**
   * @method runTests
   * @description 运行测试
   */
  public runTests(packageName?: string, watch = false): void {
    const command = packageName
      ? `pnpm --filter ${packageName} test${watch ? ' --watch' : ''}`
      : `pnpm test${watch ? ' --watch' : ''}`;

    console.log(`🧪 Running tests${packageName ? ` for ${packageName}` : ''}...`);
    execSync(command, { stdio: 'inherit' });
  }

  /**
   * @method checkCoverage
   * @description 检查测试覆盖率
   */
  public checkCoverage(packageName?: string, threshold = 80): void {
    const command = packageName
      ? `pnpm --filter ${packageName} test --coverage`
      : `pnpm test --coverage`;

    console.log(`📊 Checking coverage${packageName ? ` for ${packageName}` : ''}...`);
    console.log(`📈 Coverage threshold: ${threshold}%`);

    try {
      execSync(command, { stdio: 'inherit' });
    } catch (error) {
      console.error('❌ Coverage check failed');
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  /**
   * @method lint
   * @description 运行代码检查
   */
  public lint(fix = false): void {
    console.log(`🔍 Running linters${fix ? ' (with auto-fix)' : ''}...`);

    try {
      // Biome
      execSync(`pnpm lint:biome${fix ? ':fix' : ''}`, { stdio: 'inherit' });

      // ESLint
      execSync(`pnpm lint${fix ? ' --fix' : ''}`, { stdio: 'inherit' });
    } catch (error) {
      console.error('❌ Lint check failed');
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  /**
   * @method typeCheck
   * @description 运行类型检查
   */
  public typeCheck(): void {
    console.log('🔍 Running TypeScript type check...');

    try {
      execSync('pnpm typecheck', { stdio: 'inherit' });
      console.log('✅ Type check passed');
    } catch (error) {
      console.error('❌ Type check failed');
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  /**
   * @method format
   * @description 格式化代码
   */
  public format(): void {
    console.log('💅 Formatting code...');

    try {
      execSync('pnpm format:biome', { stdio: 'inherit' });
      console.log('✅ Code formatted successfully');
    } catch (error) {
      console.error('❌ Format failed');
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  /**
   * @method build
   * @description 构建项目
   */
  public build(): void {
    console.log('🏗️  Building project...');

    try {
      execSync('pnpm build', { stdio: 'inherit' });
      console.log('✅ Build completed successfully');
    } catch (error) {
      console.error('❌ Build failed');
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  /**
   * @method validate
   * @description 完整验证（lint + typecheck + test）
   */
  public validate(): void {
    console.log('✅ Running full validation...\n');

    try {
      this.lint();
      console.log('\n');
      this.typeCheck();
      console.log('\n');
      this.runTests();
      console.log('\n✅ All checks passed!');
    } catch (error) {
      console.error('\n❌ Validation failed');
      process.exit(1);
    }
  }

  /**
   * @method checkPackageHealth
   * @description 检查包的健康状态
   */
  public checkPackageHealth(packageName: string): void {
    console.log(`🏥 Checking health of ${packageName}...\n`);

    const packagePath = join(process.cwd(), 'packages', packageName);
    if (!existsSync(packagePath)) {
      console.error(`❌ Package ${packageName} not found`);
      process.exit(1);
    }

    const packageJsonPath = join(packagePath, 'package.json');
    if (!existsSync(packageJsonPath)) {
      console.error(`❌ package.json not found for ${packageName}`);
      process.exit(1);
    }

    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as {
      name: string;
      version: string;
      scripts?: Record<string, string>;
    };

    console.log(`📦 Package: ${packageJson.name}`);
    console.log(`📌 Version: ${packageJson.version}`);
    console.log(`📝 Scripts: ${Object.keys(packageJson.scripts ?? {}).join(', ')}`);

    // 检查测试
    if (packageJson.scripts?.test) {
      console.log('\n🧪 Running tests...');
      this.runTests(packageName);
    }

    // 检查构建
    if (packageJson.scripts?.build) {
      console.log('\n🏗️  Running build...');
      try {
        execSync(`pnpm --filter ${packageName} build`, { stdio: 'inherit' });
      } catch (error) {
        console.error('❌ Build failed');
      }
    }
  }
}

// CLI 入口
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  const tools = new DevTools();

  switch (command) {
    case 'test':
      tools.runTests(args[1], args.includes('--watch'));
      break;

    case 'coverage':
      tools.checkCoverage(args[1], Number.parseInt(args[2] || '80', 10));
      break;

    case 'lint':
      tools.lint(args.includes('--fix'));
      break;

    case 'typecheck':
      tools.typeCheck();
      break;

    case 'format':
      tools.format();
      break;

    case 'build':
      tools.build();
      break;

    case 'validate':
      tools.validate();
      break;

    case 'health':
      if (!args[1]) {
        console.error('Usage: dev-tools.ts health <package-name>');
        process.exit(1);
      }
      tools.checkPackageHealth(args[1]);
      break;

    default:
      console.log(`
Development Tools

Usage:
  node dev-tools.ts <command> [options]

Commands:
  test [package] [--watch]    Run tests
  coverage [package] [threshold] Check test coverage
  lint [--fix]                 Run linters
  typecheck                    Run TypeScript type check
  format                       Format code
  build                        Build project
  validate                     Run full validation (lint + typecheck + test)
  health <package>             Check package health

Examples:
  node dev-tools.ts test common-backend
  node dev-tools.ts coverage common-backend 85
  node dev-tools.ts lint --fix
  node dev-tools.ts validate
  node dev-tools.ts health common-backend
      `);
      process.exit(1);
  }
}
