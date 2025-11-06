import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * @class QueryParamsValidationMiddleware
 * @description 查询参数验证中间件，防止参数篡改攻击
 */
@Injectable()
export class QueryParamsValidationMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    try {
      // 1. 验证查询参数
      this.validateQueryParams(req.query);

      // 2. 验证路径参数
      this.validatePathParams(req.params);

      next();
    } catch (error) {
      next(error);
    }
  }

  /**
   * 验证查询参数
   */
  private validateQueryParams(query: any): void {
    for (const [key, value] of Object.entries(query)) {
      // 检查参数名是否安全
      this.validateParamName(key);

      // 检查参数值
      if (Array.isArray(value)) {
        value.forEach((v) => this.validateParamValue(key, v));
      } else {
        this.validateParamValue(key, value);
      }
    }
  }

  /**
   * 验证路径参数
   */
  private validatePathParams(params: any): void {
    for (const [key, value] of Object.entries(params)) {
      this.validateParamName(key);
      this.validateParamValue(key, value);
    }
  }

  /**
   * 验证参数名
   */
  private validateParamName(name: string): void {
    // 检查参数名长度
    if (name.length > 100) {
      throw new BadRequestException(`Parameter name too long: ${name}`);
    }

    // 检查参数名格式（只允许字母、数字、下划线）
    if (!/^[a-zA-Z0-9_]+$/.test(name)) {
      throw new BadRequestException(`Invalid parameter name format: ${name}`);
    }

    // 检查是否是危险的关键字
    const dangerousKeywords = [
      'union',
      'select',
      'insert',
      'update',
      'delete',
      'drop',
      'create',
      'alter',
      'exec',
      'execute',
      'script',
      'javascript',
      'vbscript',
      'onload',
      'onerror',
      'eval',
      'function',
      'constructor',
    ];

    if (dangerousKeywords.some((keyword) => name.toLowerCase().includes(keyword))) {
      throw new BadRequestException(`Dangerous parameter name detected: ${name}`);
    }
  }

  /**
   * 验证参数值
   */
  private validateParamValue(key: string, value: any): void {
    if (typeof value !== 'string') {
      return; // 只验证字符串参数
    }

    const stringValue = value as string;

    // 检查长度限制
    if (stringValue.length > 1000) {
      throw new BadRequestException(`Parameter ${key} value too long`);
    }

    // 检查SQL注入模式
    this.checkSqlInjection(key, stringValue);

    // 检查XSS攻击
    this.checkXssAttack(key, stringValue);

    // 检查路径遍历
    this.checkPathTraversal(key, stringValue);

    // 检查空字节
    if (stringValue.includes('\0')) {
      throw new BadRequestException(`Null byte detected in parameter ${key}`);
    }

    // 检查控制字符（除了换行和制表符）
    // eslint-disable-next-line no-control-regex
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(stringValue)) {
      throw new BadRequestException(`Control character detected in parameter ${key}`);
    }
  }

  /**
   * 检查SQL注入
   */
  private checkSqlInjection(key: string, value: string): void {
    const sqlKeywords = [
      'SELECT',
      'INSERT',
      'UPDATE',
      'DELETE',
      'DROP',
      'CREATE',
      'ALTER',
      'EXEC',
      'UNION',
    ];
    const sqlPatterns = [
      new RegExp(`\\b(${sqlKeywords.join('|')})\\b`, 'i'),
      /['"]/,
      /(--|#)/,
      /\b(OR|AND)\b.*[=<>]/i,
    ];

    if (sqlPatterns.some((pattern) => pattern.test(value))) {
      throw new BadRequestException(`Potential SQL injection detected in parameter ${key}`);
    }
  }

  /**
   * 检查XSS攻击
   */
  private checkXssAttack(key: string, value: string): void {
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /onload\s*=/gi,
      /onerror\s*=/gi,
      /<iframe[^>]*>/gi,
      /<object[^>]*>/gi,
      /<embed[^>]*>/gi,
    ];

    if (xssPatterns.some((pattern) => pattern.test(value))) {
      throw new BadRequestException(`Potential XSS attack detected in parameter ${key}`);
    }
  }

  /**
   * 检查路径遍历
   */
  private checkPathTraversal(key: string, value: string): void {
    const traversalPatterns = [/\.\./, /\.\//, /\.\\/, /\/etc\/passwd/i, /\/windows\/system32/i];

    if (traversalPatterns.some((pattern) => pattern.test(value))) {
      throw new BadRequestException(`Path traversal detected in parameter ${key}`);
    }
  }
}
