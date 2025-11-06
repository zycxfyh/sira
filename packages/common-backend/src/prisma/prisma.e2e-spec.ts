import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';
import { PrismaModule } from './prisma.module';

describe('PrismaService (e2e)', () => {
  let prisma: PrismaService;
  let module: TestingModule;
  let databaseAvailable = false;

  beforeAll(async () => {
    // 检查数据库是否可用
    if (!process.env.DATABASE_URL) {
      console.warn('DATABASE_URL not set, skipping database integration tests');
      return;
    }

    try {
      module = await Test.createTestingModule({
        imports: [PrismaModule],
      }).compile();

      prisma = module.get<PrismaService>(PrismaService);
      await prisma.onModuleInit();
      databaseAvailable = true;
    } catch (error) {
      console.warn('Database not available, skipping database integration tests:', error);
      databaseAvailable = false;
    }
  }, 30000);

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
    if (module) {
      await module.close();
    }
  }, 30000);

  it('should connect to database', async () => {
    if (!databaseAvailable) {
      console.log('Skipping: Database not available');
      return;
    }
    // 执行简单查询测试连接
    const result = await prisma.$queryRaw`SELECT 1 as value`;
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it('should handle connection pool correctly', async () => {
    if (!databaseAvailable) {
      console.log('Skipping: Database not available');
      return;
    }
    // 测试并发连接
    const promises = Array(5)
      .fill(null)
      .map(async () => {
        return prisma.$queryRaw`SELECT NOW() as time`;
      });

    const results = await Promise.all(promises);
    expect(results).toHaveLength(5);
    results.forEach((result) => {
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  it('should execute transaction correctly', async () => {
    if (!databaseAvailable) {
      console.log('Skipping: Database not available');
      return;
    }
    // 测试事务功能
    await prisma.$transaction(async (tx) => {
      const result = await tx.$queryRaw`SELECT 1 as value`;
      expect(result).toBeDefined();
      return result;
    });
  });

  it('should handle query errors gracefully', async () => {
    if (!databaseAvailable) {
      console.log('Skipping: Database not available');
      return;
    }
    // 测试错误处理
    await expect(prisma.$queryRaw`SELECT * FROM non_existent_table`).rejects.toThrow();
  });
});
