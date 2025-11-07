// 文件路径: packages/shared-types/src/api/types.ts
// 核心理念: 前后端共享的 API 类型定义

/**
 * @interface ApiResponse
 * @description 统一的 API 响应格式
 */
export interface ApiResponse<T = unknown> {
  /** 数据 */
  data: T;
  /** 消息 */
  message?: string;
  /** 状态码 */
  status: number;
  /** 时间戳 */
  timestamp?: string;
}

/**
 * @interface ApiError
 * @description API 错误响应
 */
export interface ApiError {
  /** 错误消息 */
  message: string;
  /** 错误代码 */
  code?: string;
  /** 状态码 */
  status: number;
  /** 错误详情 */
  details?: Record<string, unknown>;
  /** 时间戳 */
  timestamp?: string;
}

/**
 * @interface PaginatedResponse
 * @description 分页响应
 */
export interface PaginatedResponse<T> {
  /** 数据列表 */
  data: T[];
  /** 总数 */
  total: number;
  /** 当前页 */
  page: number;
  /** 每页数量 */
  pageSize: number;
  /** 总页数 */
  totalPages: number;
}

/**
 * @interface PaginationParams
 * @description 分页参数
 */
export interface PaginationParams {
  /** 页码 */
  page?: number;
  /** 每页数量 */
  pageSize?: number;
  /** 排序字段 */
  sortBy?: string;
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc';
}
