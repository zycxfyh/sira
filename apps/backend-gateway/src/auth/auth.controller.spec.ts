import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

describe('AuthController', () => {
  let controller: AuthController;
  let authServiceMock: DeepMockProxy<AuthService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockLoginResponse = {
    access_token: 'jwt-token-here',
  };

  beforeEach(async () => {
    authServiceMock = mockDeep<AuthService>();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authServiceMock,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('should register a new user successfully', async () => {
      authServiceMock.register.mockResolvedValue(mockUser);

      const result = await controller.register(registerDto);

      expect(authServiceMock.register).toHaveBeenCalledWith(registerDto);
      expect(result).toEqual(mockUser);
    });

    it('should throw ConflictException when email already exists', async () => {
      const conflictError = new ConflictException('Email already registered.');
      authServiceMock.register.mockRejectedValue(conflictError);

      await expect(controller.register(registerDto)).rejects.toThrow(ConflictException);
      expect(authServiceMock.register).toHaveBeenCalledWith(registerDto);
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('should login user successfully', async () => {
      authServiceMock.login.mockResolvedValue(mockLoginResponse);

      const result = await controller.login(loginDto);

      expect(authServiceMock.login).toHaveBeenCalledWith(loginDto);
      expect(result).toEqual(mockLoginResponse);
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      const unauthorizedError = new UnauthorizedException('Invalid credentials.');
      authServiceMock.login.mockRejectedValue(unauthorizedError);

      await expect(controller.login(loginDto)).rejects.toThrow(UnauthorizedException);
      expect(authServiceMock.login).toHaveBeenCalledWith(loginDto);
    });
  });

  describe('getProfile', () => {
    it('should return user profile from request', () => {
      const mockRequest = {
        user: mockUser,
      } as any;

      const result = controller.getProfile(mockRequest);

      expect(result).toEqual(mockUser);
    });
  });
});
