// 文件路径: tools/scripts/prisma-migration-helper.ts
// 灵感来源: Prisma (https://github.com/prisma/prisma)
// 核心理念: 增强的迁移工具，提供类型检查和验证

import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

/**
 * @interface MigrationOptions
 * @description 迁移选项
 */
interface MigrationOptions {
  /** 迁移名称 */
  name: string;
  /** 是否创建迁移 */
  createOnly?: boolean;
  /** 是否应用迁移 */
  apply?: boolean;
  /** 是否验证类型 */
  validateTypes?: boolean;
}

/**
 * @class PrismaMigrationHelper
 * @description Prisma 迁移辅助工具
 * 提供迁移生成、验证、类型检查等功能
 */
export class PrismaMigrationHelper {
  private readonly prismaSchemaPath: string;

  constructor(prismaSchemaPath = "packages/common-backend/prisma/schema.prisma") {
    this.prismaSchemaPath = prismaSchemaPath;
  }

  /**
   * @method createMigration
   * @description 创建新的迁移
   */
  public createMigration(options: MigrationOptions): void {
    const { name, createOnly = false } = options;

    console.log(`📝 Creating migration: ${name}`);

    try {
      // 验证 Schema 文件存在
      if (!existsSync(this.prismaSchemaPath)) {
        throw new Error(`Schema file not found: ${this.prismaSchemaPath}`);
      }

      // 生成迁移
      const command = createOnly
        ? `npx prisma migrate dev --create-only --name ${name}`
        : `npx prisma migrate dev --name ${name}`;

      execSync(command, {
        stdio: "inherit",
        cwd: join(process.cwd(), "packages/common-backend"),
      });

      console.log(`✅ Migration created: ${name}`);

      // 验证类型
      if (options.validateTypes) {
        this.validateTypes();
      }
    } catch (error) {
      console.error(`❌ Failed to create migration: ${name}`);
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  /**
   * @method applyMigration
   * @description 应用迁移
   */
  public applyMigration(): void {
    console.log("🔄 Applying migrations...");

    try {
      execSync("npx prisma migrate deploy", {
        stdio: "inherit",
        cwd: join(process.cwd(), "packages/common-backend"),
      });

      console.log("✅ Migrations applied successfully");
    } catch (error) {
      console.error("❌ Failed to apply migrations");
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  /**
   * @method validateTypes
   * @description 验证类型同步
   */
  public validateTypes(): void {
    console.log("🔍 Validating TypeScript types...");

    try {
      // 生成 Prisma Client
      execSync("npx prisma generate", {
        stdio: "inherit",
        cwd: join(process.cwd(), "packages/common-backend"),
      });

      // 检查 TypeScript 编译
      execSync("pnpm run typecheck", {
        stdio: "inherit",
      });

      console.log("✅ Type validation passed");
    } catch (error) {
      console.error("❌ Type validation failed");
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  /**
   * @method resetDatabase
   * @description 重置数据库（开发环境）
   */
  public resetDatabase(): void {
    console.log("⚠️  Resetting database...");

    try {
      execSync("npx prisma migrate reset --force", {
        stdio: "inherit",
        cwd: join(process.cwd(), "packages/common-backend"),
      });

      console.log("✅ Database reset successfully");
    } catch (error) {
      console.error("❌ Failed to reset database");
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  /**
   * @method formatSchema
   * @description 格式化 Schema 文件
   */
  public formatSchema(): void {
    console.log("📝 Formatting Prisma schema...");

    try {
      execSync("npx prisma format", {
        stdio: "inherit",
        cwd: join(process.cwd(), "packages/common-backend"),
      });

      console.log("✅ Schema formatted successfully");
    } catch (error) {
      console.error("❌ Failed to format schema");
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }
}

// CLI 入口
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  const helper = new PrismaMigrationHelper();

  switch (command) {
    case "create":
      helper.createMigration({
        name: args[1] || "migration",
        createOnly: args.includes("--create-only"),
        validateTypes: args.includes("--validate"),
      });
      break;

    case "apply":
      helper.applyMigration();
      break;

    case "validate":
      helper.validateTypes();
      break;

    case "reset":
      helper.resetDatabase();
      break;

    case "format":
      helper.formatSchema();
      break;

    default:
      console.log(`
Prisma Migration Helper

Usage:
  node prisma-migration-helper.ts <command> [options]

Commands:
  create <name>     Create a new migration
  apply             Apply pending migrations
  validate          Validate TypeScript types
  reset             Reset database (dev only)
  format            Format Prisma schema

Options:
  --create-only     Create migration without applying
  --validate        Validate types after migration
      `);
      process.exit(1);
  }
}

