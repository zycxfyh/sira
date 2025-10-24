// 文件路径: apps/backend/prisma/seed.ts

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

// 初始化 Prisma 客户端
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');
  await prisma.user.deleteMany({
    where: {
      email: 'test@example.com',
    },
  });
  console.log('  - Deleted existing test user.');
  const hashedPassword = await bcrypt.hash('password123', 10);

  const testUser = await prisma.user.create({
    data: {
      email: 'test@example.com',
      password: hashedPassword,
    },
  });

  console.log('  + Created test user:', { id: testUser.id, email: testUser.email });
  console.log('Database seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    // 关闭 Prisma 客户端连接
    await prisma.$disconnect();
  });