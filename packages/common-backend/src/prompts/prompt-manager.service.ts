// 文件路徑: libs/common/src/prompts/prompt-manager.service.ts

import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class PromptManagerService implements OnModuleInit {
  private readonly logger = new Logger(PromptManagerService.name);
  private readonly promptCache = new Map<string, string>();
  // [核心] 定位到我們新建的 assets 文件夾
  private readonly promptsDir = path.join(__dirname, 'assets');

  /**
   * NestJS生命週期鉤子，在模塊初始化時自動調用。
   */
  async onModuleInit() {
    this.logger.log('Initializing PromptManagerService...');
    await this.loadAllPrompts();
  }

  /**
   * 從緩存中獲取一個已加載的prompt。
   * @param filename - 例如 '01_logic_engine.md'
   * @returns 文件的字符串內容
   */
  public getPrompt(filename: string): string {
    const prompt = this.promptCache.get(filename);
    if (!prompt) {
      // 在生產環境中，如果啟動時未能加載prompt，這是一個致命錯誤
      throw new Error(
        `Prompt "${filename}" not found in cache. Ensure it exists in the assets directory and was loaded at startup.`,
      );
    }
    return prompt;
  }

  /**
   * 讀取 assets 文件夾中的所有 .md 文件並將其緩存到內存中。
   */
  private async loadAllPrompts() {
    try {
      const files = await fs.readdir(this.promptsDir);
      const markdownFiles = files.filter((file) => file.endsWith('.md'));

      if (markdownFiles.length === 0) {
        this.logger.warn(`No prompt files (.md) found in ${this.promptsDir}`);
        return;
      }

      for (const file of markdownFiles) {
        const filePath = path.join(this.promptsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        this.promptCache.set(file, content);
        this.logger.log(`  [+] Loaded prompt: ${file}`);
      }

      this.logger.log(
        `Successfully loaded ${this.promptCache.size} prompt(s).`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to load prompts from filesystem at ${this.promptsDir}.`,
        error,
      );
      // 這是一個致命的啟動錯誤，我們應該拋出它來停止應用
      throw new Error('Could not initialize prompts. Halting application.');
    }
  }
}