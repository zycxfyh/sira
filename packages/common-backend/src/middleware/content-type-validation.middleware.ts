import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * @class ContentTypeValidationMiddleware
 * @description Content-Type验证中间件，防止恶意内容类型攻击
 */
@Injectable()
export class ContentTypeValidationMiddleware implements NestMiddleware {
  /**
   * 允许的内容类型列表
   */
  private readonly allowedContentTypes = [
    'application/json',
    'application/x-www-form-urlencoded',
    'multipart/form-data',
    'text/plain',
  ];

  use(req: Request, res: Response, next: NextFunction): void {
    try {
      // 1. 验证Content-Type头
      this.validateContentType(req);

      // 2. 验证Content-Length
      this.validateContentLength(req);

      next();
    } catch (error) {
      next(error);
    }
  }

  /**
   * 验证Content-Type头
   */
  private validateContentType(req: Request): void {
    const contentType = req.headers['content-type'];

    // 对于非GET请求，必须有Content-Type
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
      if (!contentType) {
        throw new BadRequestException('Content-Type header is required for this request method');
      }

      // 验证Content-Type格式
      this.validateContentTypeFormat(contentType);
    }
  }

  /**
   * 验证Content-Type格式
   */
  private validateContentTypeFormat(contentType: string): void {
    try {
      // 解析Content-Type
      const [mimeType, parameters] = contentType.split(';');

      // 检查是否为允许的MIME类型
      if (!this.allowedContentTypes.some((allowed) => mimeType.toLowerCase().includes(allowed))) {
        throw new BadRequestException(`Unsupported content type: ${mimeType}`);
      }

      // 验证charset参数（如果存在）
      if (parameters) {
        this.validateCharsetParameter(parameters.trim());
      }

      // 检查其他参数
      this.validateAdditionalParameters(contentType);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Invalid Content-Type format');
    }
  }

  /**
   * 验证charset参数
   */
  private validateCharsetParameter(parameters: string): void {
    const charsetMatch = parameters.match(/charset\s*=\s*([^;\s]+)/i);
    if (charsetMatch) {
      const charset = charsetMatch[1].toLowerCase();
      // 只允许UTF-8编码
      if (!['utf-8', 'utf8'].includes(charset)) {
        throw new BadRequestException(
          `Unsupported charset '${charset}' for JSON content. Only UTF-8 is allowed.`,
        );
      }
    }
  }

  /**
   * 验证其他参数
   */
  private validateAdditionalParameters(contentType: string): void {
    const parts = contentType.split(';').slice(1);
    for (const part of parts) {
      const [key] = part.trim().split('=');
      if (key && key !== 'charset') {
        throw new BadRequestException(`Unsupported parameter '${key}' in Content-Type header`);
      }
    }
  }

  /**
   * 验证Content-Length
   */
  private validateContentLength(req: Request): void {
    const contentLength = req.headers['content-length'];

    if (contentLength) {
      const length = parseInt(contentLength, 10);

      // 检查长度是否合理
      if (isNaN(length) || length < 0) {
        throw new BadRequestException('Invalid Content-Length header');
      }

      // 设置最大请求体大小（例如：10MB）
      const maxBodySize = 10 * 1024 * 1024; // 10MB
      if (length > maxBodySize) {
        throw new BadRequestException('Request body too large');
      }
    }
  }
}
