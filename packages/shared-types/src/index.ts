// 文件路径: packages/shared-types/src/index.ts
    // 职责: 统一导出所有前后端共享的类型定义
    
    // 示例: 定义一个User类型
    export interface UserProfile {
      id: string;
      email: string;
      createdAt: string;
    }
    
    // 示例: 定义API响应格式
    export interface ApiResponse<T> {
      success: boolean;
      data: T;
      error?: string;
    }