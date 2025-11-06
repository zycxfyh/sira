import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * @class EncodingValidationMiddleware
 * @description 编码验证中间件，防止UTF-8编码攻击
 */
@Injectable()
export class EncodingValidationMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    try {
      // 1. 验证URL编码
      this.validateUrlEncoding(req);

      // 2. 验证UTF-8编码
      this.validateUtf8Encoding(req);

      // 3. 验证查询参数编码
      this.validateQueryParamEncoding(req);

      // 4. 验证请求体编码（如果适用）
      this.validateBodyEncoding(req);

      next();
    } catch (error) {
      next(error);
    }
  }

  /**
   * 验证URL编码
   */
  private validateUrlEncoding(req: Request): void {
    // 检查URL路径是否包含危险的编码
    const path = req.path;
    const query = req.url.split('?')[1] || '';

    // 检查URL编码的百分号是否正确
    const invalidPercentEncoding = /%[^0-9A-Fa-f]{2}/g;
    if (invalidPercentEncoding.test(path) || invalidPercentEncoding.test(query)) {
      throw new BadRequestException('Invalid URL encoding detected');
    }

    // 检查双重编码
    const doubleEncoding = /%25[0-9A-Fa-f]{2}/gi;
    if (doubleEncoding.test(path) || doubleEncoding.test(query)) {
      throw new BadRequestException('Double URL encoding detected');
    }
  }

  /**
   * 验证UTF-8编码
   */
  private validateUtf8Encoding(req: Request): void {
    // 检查查询参数中的UTF-8编码
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') {
        this.validateUtf8String(key, value);
      } else if (Array.isArray(value)) {
        value.forEach((v) => {
          if (typeof v === 'string') {
            this.validateUtf8String(key, v);
          }
        });
      }
    }

    // 检查路径参数
    for (const [key, value] of Object.entries(req.params)) {
      if (typeof value === 'string') {
        this.validateUtf8String(key, value);
      }
    }

    // 检查请求头（某些情况下）
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') {
        this.validateUtf8String(`header-${key}`, value);
      } else if (Array.isArray(value)) {
        value.forEach((v) => {
          if (typeof v === 'string') {
            this.validateUtf8String(`header-${key}`, v);
          }
        });
      }
    }
  }

  /**
   * 验证UTF-8字符串
   */
  private validateUtf8String(source: string, value: string): void {
    try {
      // 尝试解码为UTF-8
      const decoded = decodeURIComponent(value);

      // 检查是否包含超长UTF-8序列（overlong encoding）
      this.checkOverlongUtf8(source, decoded);

      // 检查零宽度字符
      this.checkZeroWidthCharacters(source, decoded);

      // 检查不规范的UTF-8序列
      this.checkInvalidUtf8Sequences(source, decoded);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown encoding error';
      throw new BadRequestException(`Invalid encoding in ${source}: ${message}`);
    }
  }

  /**
   * 检查超长UTF-8编码
   */
  private checkOverlongUtf8(source: string, value: string): void {
    // 检查ASCII字符是否使用了多字节编码
    for (let i = 0; i < value.length; i++) {
      const char = value.charAt(i);
      const codePoint = value.codePointAt(i);

      if (codePoint !== undefined) {
        // 检查是否是ASCII字符但使用了多字节编码
        if (codePoint <= 0x7f && value.length > 1) {
          const utf8Bytes = this.getUtf8ByteLength(char);
          if (utf8Bytes > 1) {
            throw new BadRequestException(`Overlong UTF-8 encoding detected in ${source}`);
          }
        }

        // 跳过代理对
        if (codePoint > 0xffff) {
          i++; // 代理对占用两个字符位置
        }
      }
    }
  }

  /**
   * 检查零宽度字符
   */
  private checkZeroWidthCharacters(source: string, value: string): void {
    const zeroWidthChars = [
      '\u200B', // ZERO WIDTH SPACE
      '\u200C', // ZERO WIDTH NON-JOINER
      '\u200D', // ZERO WIDTH JOINER
      '\u200E', // LEFT-TO-RIGHT MARK
      '\u200F', // RIGHT-TO-LEFT MARK
      '\uFEFF', // ZERO WIDTH NO-BREAK SPACE (BOM)
    ];

    for (const char of zeroWidthChars) {
      if (value.includes(char)) {
        throw new BadRequestException(`Zero-width character detected in ${source}`);
      }
    }
  }

  /**
   * 检查无效的UTF-8序列
   */
  private checkInvalidUtf8Sequences(source: string, value: string): void {
    // 检查不完整的UTF-8序列
    const invalidSequences = [
      // 不完整的多字节序列开头
      /[\xC0-\xDF](?![\x80-\xBF])/g, // 2字节序列不完整
      /[\xE0-\xEF](?![\x80-\xBF]{2})/g, // 3字节序列不完整
      /[\xF0-\xF7](?![\x80-\xBF]{3})/g, // 4字节序列不完整

      // 错误的延续字节
      /(?<![\xC0-\xF7])[\x80-\xBF]/g, // 没有开头的延续字节
    ];

    for (const pattern of invalidSequences) {
      if (pattern.test(value)) {
        throw new BadRequestException(`Invalid UTF-8 sequence detected in ${source}`);
      }
    }
  }

  /**
   * 获取UTF-8字节长度
   */
  private getUtf8ByteLength(char: string): number {
    const codePoint = char.codePointAt(0);
    if (codePoint === undefined) return 0;

    if (codePoint <= 0x7f) return 1;
    if (codePoint <= 0x7ff) return 2;
    if (codePoint <= 0xffff) return 3;
    return 4;
  }

  /**
   * 验证查询参数编码
   */
  private validateQueryParamEncoding(req: Request): void {
    // 检查查询参数是否正确编码
    const queryString = req.url.split('?')[1];
    if (queryString) {
      // 检查是否有未编码的特殊字符
      // eslint-disable-next-line no-control-regex
      const unencodedSpecialChars = /[\x00-\x1F\x7F-\x9F]/;
      if (unencodedSpecialChars.test(queryString)) {
        throw new BadRequestException('Unencoded special characters in query string');
      }
    }
  }

  /**
   * 验证请求体编码
   */
  private validateBodyEncoding(req: Request): void {
    // 对于JSON请求体，验证UTF-8编码
    if (req.headers['content-type']?.includes('application/json')) {
      // 这通常由Express的body-parser处理
      // 但我们可以添加额外的验证
      if (req.body && typeof req.body === 'string') {
        try {
          JSON.parse(req.body);
        } catch {
          throw new BadRequestException('Invalid JSON encoding in request body');
        }
      }
    }
  }
}
