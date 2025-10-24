// 文件路径: apps/nexus-engine/src/auth/auth.controller.ts

import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Get,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

// [核心修正] 从 @app/common 导入共享的 ZodValidationPipe
import { ZodValidationPipe } from '@app/common';

// 导入DTO类型和Zod schema
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';
import { registerSchema } from './dto/register.dto';
import { loginSchema } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  public async register(
    @Body(new ZodValidationPipe(registerSchema)) registerDto: RegisterDto,
  ) {
    return this.authService.register(registerDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  public async login(
    @Body(new ZodValidationPipe(loginSchema)) loginDto: LoginDto,
  ) {
    return this.authService.login(loginDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  public getProfile(@Req() req: Request) {
    return req.user;
  }
}