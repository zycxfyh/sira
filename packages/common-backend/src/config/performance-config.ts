// 文件路径: packages/common-backend/src/config/performance-config.ts
// 职责: 性能监控基线配置和SLA指标定义

/**
 * @interface SLATargets
 * @description SLA目标定义
 */
export interface SLATargets {
  /** 响应时间目标 (毫秒) */
  responseTime: {
    /** P50响应时间 */
    p50: number;
    /** P95响应时间 */
    p95: number;
    /** P99响应时间 */
    p99: number;
  };
  /** 可用性目标 (百分比) */
  availability: number;
  /** 错误率目标 (百分比) */
  errorRate: number;
  /** 吞吐量目标 (RPS) */
  throughput: number;
}

/**
 * @interface PerformanceThresholds
 * @description 性能阈值配置
 */
export interface PerformanceThresholds {
  /** 警告阈值 */
  warning: number;
  /** 严重阈值 */
  critical: number;
  /** 紧急阈值 */
  emergency: number;
}

/**
 * @interface ServiceSLAs
 * @description 各服务的SLA配置
 */
export interface ServiceSLAs {
  /** API网关 */
  api: SLATargets;
  /** AI推理服务 */
  ai: SLATargets;
  /** 数据库查询 */
  database: SLATargets;
  /** 缓存操作 */
  cache: SLATargets;
  /** 消息队列 */
  queue: SLATargets;
  /** WebSocket连接 */
  websocket: SLATargets;
}

/**
 * @constant PERFORMANCE_CONFIG
 * @description 性能监控配置
 */
export const PERFORMANCE_CONFIG = {
  // SLA目标
  slas: {
    api: {
      responseTime: { p50: 200, p95: 500, p99: 1000 },
      availability: 99.9,
      errorRate: 0.1,
      throughput: 1000,
    },
    ai: {
      responseTime: { p50: 2000, p95: 3000, p99: 5000 },
      availability: 99.5,
      errorRate: 1.0,
      throughput: 100,
    },
    database: {
      responseTime: { p50: 50, p95: 200, p99: 500 },
      availability: 99.9,
      errorRate: 0.01,
      throughput: 5000,
    },
    cache: {
      responseTime: { p50: 5, p95: 20, p99: 50 },
      availability: 99.99,
      errorRate: 0.001,
      throughput: 10000,
    },
    queue: {
      responseTime: { p50: 100, p95: 500, p99: 2000 },
      availability: 99.9,
      errorRate: 0.1,
      throughput: 2000,
    },
    websocket: {
      responseTime: { p50: 50, p95: 100, p99: 200 },
      availability: 99.9,
      errorRate: 0.1,
      throughput: 5000,
    },
  } as ServiceSLAs,

  // 性能阈值
  thresholds: {
    responseTime: {
      warning: 1000, // 1秒
      critical: 3000, // 3秒
      emergency: 10000, // 10秒
    },
    errorRate: {
      warning: 1.0, // 1%
      critical: 5.0, // 5%
      emergency: 10.0, // 10%
    },
    cpuUsage: {
      warning: 70, // 70%
      critical: 85, // 85%
      emergency: 95, // 95%
    },
    memoryUsage: {
      warning: 80, // 80%
      critical: 90, // 90%
      emergency: 95, // 95%
    },
    connectionCount: {
      warning: 1000, // 1000连接
      critical: 2000, // 2000连接
      emergency: 5000, // 5000连接
    },
  } as Record<string, PerformanceThresholds>,

  // 监控配置
  monitoring: {
    /** 采样率 */
    sampleRate: 0.1, // 10%采样

    /** 指标收集间隔 (毫秒) */
    collectionInterval: 60000, // 1分钟

    /** 告警检查间隔 (毫秒) */
    alertCheckInterval: 300000, // 5分钟

    /** 性能报告生成间隔 (毫秒) */
    reportInterval: 3600000, // 1小时

    /** 历史数据保留天数 */
    retentionDays: 30,
  },

  // 容量规划
  capacity: {
    /** 最大并发用户数 */
    maxConcurrentUsers: 10000,

    /** 数据库连接池大小 */
    dbConnectionPool: 50,

    /** Redis连接池大小 */
    redisConnectionPool: 100,

    /** WebSocket最大连接数 */
    maxWebSocketConnections: 50000,

    /** 队列并发处理数 */
    queueConcurrency: 20,
  },
};

/**
 * @function getSLATarget
 * @description 获取指定服务的SLA目标
 */
export function getSLATarget(service: keyof ServiceSLAs): SLATargets {
  return PERFORMANCE_CONFIG.slas[service];
}

/**
 * @function getPerformanceThreshold
 * @description 获取指定指标的性能阈值
 */
export function getPerformanceThreshold(
  metric: string,
  level: keyof PerformanceThresholds,
): number {
  return PERFORMANCE_CONFIG.thresholds[metric]?.[level] || 0;
}

/**
 * @function isPerformanceHealthy
 * @description 检查性能指标是否健康
 */
export function isPerformanceHealthy(
  service: keyof ServiceSLAs,
  metric: 'responseTime' | 'errorRate' | 'availability',
  value: number,
): { healthy: boolean; level: 'healthy' | 'warning' | 'critical' | 'emergency' } {
  const sla = getSLATarget(service);

  switch (metric) {
    case 'responseTime':
      if (value <= sla.responseTime.p95) return { healthy: true, level: 'healthy' };
      if (value <= getPerformanceThreshold('responseTime', 'warning'))
        return { healthy: false, level: 'warning' };
      if (value <= getPerformanceThreshold('responseTime', 'critical'))
        return { healthy: false, level: 'critical' };
      return { healthy: false, level: 'emergency' };

    case 'errorRate':
      if (value <= sla.errorRate) return { healthy: true, level: 'healthy' };
      if (value <= getPerformanceThreshold('errorRate', 'warning'))
        return { healthy: false, level: 'warning' };
      if (value <= getPerformanceThreshold('errorRate', 'critical'))
        return { healthy: false, level: 'critical' };
      return { healthy: false, level: 'emergency' };

    case 'availability':
      if (value >= sla.availability) return { healthy: true, level: 'healthy' };
      if (value >= sla.availability - 0.1) return { healthy: false, level: 'warning' };
      if (value >= sla.availability - 0.5) return { healthy: false, level: 'critical' };
      return { healthy: false, level: 'emergency' };

    default:
      return { healthy: true, level: 'healthy' };
  }
}
