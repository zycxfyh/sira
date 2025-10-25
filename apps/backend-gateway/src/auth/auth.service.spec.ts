// 文件路径: apps/nexus-engine/src/auth/auth.service.spec.ts (修正版)

import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '@tuheg/common-backend';
import { JwtService } from '@nestjs/jwt';
import * as bcryptjs from 'bcryptjs'; // [核心修正] 导入 bcryptjs

// [核心修正] 模拟 bcryptjs 而不是 bcrypt
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashedPassword'),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: {} },
        { provide: JwtService, useValue: {} },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('password hashing', () => {
    it('should hash the password during registration', async () => {
      const registerDto = { email: 'test@example.com', password: 'plainPassword' };
      const prismaMock = {
        user: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: '1', email: 'test@example.com' }),
        },
      } as any;
      
      (service as any).prisma = prismaMock;

      await service.register(registerDto);

      // [核心修正] 断言 bcryptjs.hash 被调用
      expect(bcryptjs.hash).toHaveBeenCalledWith('plainPassword', 10);
      
      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: {
          email: 'test@example.com',
          password: 'hashedPassword',
        },
      });
    });
  });
});