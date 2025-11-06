// 文件路径: packages/common-backend/src/observability/performance-monitor.service.ts
// 职责: 性能监控服务，实现SLA指标收集和告警

import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import * as os from "os";
import {
  PERFORMANCE_CONFIG,
  getSLATarget,
  isPerformanceHealthy,
  type ServiceSLAs,
} from "../config/performance-config";

/**
 * @interface PerformanceMetrics
 * @description 性能指标数据结构
 */
export interface PerformanceMetrics {
  timestamp: number;
  service: keyof ServiceSLAs;
  responseTime: {
    p50: number;
    p95: number;
    p99: number;
    avg: number;
  };
  errorRate: number;
  availability: number;
  throughput: number;
  system: {
    cpuUsage: number;
    memoryUsage: number;
    activeConnections: number;
  };
}

/**
 * @interface AlertCondition
 * @description 告警条件
 */
export interface AlertCondition {
  service: keyof ServiceSLAs;
  metric: string;
  threshold: number;
  currentValue: number;
  level: 'warning' | 'critical' | 'emergency' | 'healthy';
  timestamp: number;
}

/**
 * @service PerformanceMonitorService
 * @description 性能监控服务
 */
@Injectable()
export class PerformanceMonitorService {
  private readonly logger = new Logger(PerformanceMonitorService.name);

  // 指标存储 (内存中，生产环境建议使用Redis或数据库)
  private readonly metrics: PerformanceMetrics[] = [];
  private readonly alerts: AlertCondition[] = [];

  // 计数器
  private requestCount = 0;
  private errorCount = 0;
  private responseTimes: number[] = [];

  constructor() {
    this.logger.log("PerformanceMonitorService initialized with SLA targets");
  }

  /**
   * @method recordRequest
   * @description 记录API请求
   */
  recordRequest(_service: keyof ServiceSLAs, responseTime: number, isError = false): void {
    this.requestCount++;
    this.responseTimes.push(responseTime);

    if (isError) {
      this.errorCount++;
    }

    // 保持最近1000个响应时间的记录
    if (this.responseTimes.length > 1000) {
      this.responseTimes.shift();
    }
  }

  /**
   * @method collectMetrics
   * @description 收集当前性能指标
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async collectMetrics(): Promise<void> {
    try {
      const metrics = await this.gatherCurrentMetrics();
      this.metrics.push(metrics);

      // 保持最近24小时的数据
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      this.metrics.splice(
        0,
        this.metrics.findIndex(m => m.timestamp < oneDayAgo),
      );

      // 检查SLA合规性
      await this.checkSLAViolations(metrics);

      this.logger.debug(`Performance metrics collected: ${JSON.stringify(metrics)}`);
    } catch (error) {
      this.logger.error("Failed to collect performance metrics:", error);
    }
  }

  /**
   * @method checkSLAViolations
   * @description 检查SLA违规
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkSLAViolations(metrics: PerformanceMetrics): Promise<void> {
    const sla = getSLATarget(metrics.service);

    // 检查响应时间
    const rtHealth = isPerformanceHealthy(metrics.service, 'responseTime', metrics.responseTime.p95);
    if (!rtHealth.healthy) {
      await this.createAlert({
        service: metrics.service,
        metric: 'responseTime',
        threshold: sla.responseTime.p95,
        currentValue: metrics.responseTime.p95,
        level: rtHealth.level,
        timestamp: Date.now(),
      });
    }

    // 检查错误率
    const erHealth = isPerformanceHealthy(metrics.service, 'errorRate', metrics.errorRate);
    if (!erHealth.healthy) {
      await this.createAlert({
        service: metrics.service,
        metric: 'errorRate',
        threshold: sla.errorRate,
        currentValue: metrics.errorRate,
        level: erHealth.level,
        timestamp: Date.now(),
      });
    }

    // 检查可用性
    const avHealth = isPerformanceHealthy(metrics.service, 'availability', metrics.availability);
    if (!avHealth.healthy) {
      await this.createAlert({
        service: metrics.service,
        metric: 'availability',
        threshold: sla.availability,
        currentValue: metrics.availability,
        level: avHealth.level,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * @method createAlert
   * @description 创建告警
   */
  private async createAlert(alert: AlertCondition): Promise<void> {
    this.alerts.push(alert);

    // 保持最近100个告警
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }

    // 发送告警通知 (这里可以集成邮件、Slack等)
    this.logger.warn(`🚨 Performance Alert: ${alert.service} ${alert.metric} ${alert.level} - ${alert.currentValue} > ${alert.threshold}`);

    // TODO: 集成Sentry或其他告警系统
  }

  /**
   * @method gatherCurrentMetrics
   * @description 收集当前系统指标
   */
  private async gatherCurrentMetrics(): Promise<PerformanceMetrics> {
    // 计算响应时间百分位数
    const sortedTimes = [...this.responseTimes].sort((a, b) => a - b);
    const p50 = this.calculatePercentile(sortedTimes, 50);
    const p95 = this.calculatePercentile(sortedTimes, 95);
    const p99 = this.calculatePercentile(sortedTimes, 99);
    const avg = this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;

    // 计算错误率
    const errorRate = this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0;

    // 系统指标
    const cpuUsage = os.loadavg()[0] / os.cpus().length * 100;
    const memoryUsage = (os.totalmem() - os.freemem()) / os.totalmem() * 100;

    // 模拟活跃连接数 (生产环境需要从WebSocket网关获取)
    const activeConnections = 0; // TODO: 集成WebSocket连接计数

    return {
      timestamp: Date.now(),
      service: 'api', // 默认监控API服务
      responseTime: { p50, p95, p99, avg },
      errorRate,
      availability: 99.9, // TODO: 计算真实可用性
      throughput: this.requestCount,
      system: {
        cpuUsage,
        memoryUsage,
        activeConnections,
      },
    };
  }

  /**
   * @method calculatePercentile
   * @description 计算百分位数
   */
  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;

    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      return sortedArray[lower];
    }

    return sortedArray[lower] + (sortedArray[upper] - sortedArray[lower]) * (index - lower);
  }

  /**
   * @method getMetrics
   * @description 获取性能指标
   */
  getMetrics(hours: number = 1): PerformanceMetrics[] {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return this.metrics.filter(m => m.timestamp >= cutoff);
  }

  /**
   * @method getAlerts
   * @description 获取告警列表
   */
  getAlerts(hours: number = 24): AlertCondition[] {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return this.alerts.filter(a => a.timestamp >= cutoff);
  }

  /**
   * @method getSLASummary
   * @description 获取SLA摘要
   */
  getSLASummary(): Record<keyof ServiceSLAs, {
    target: any;
    current: any;
    status: 'healthy' | 'warning' | 'critical' | 'emergency';
  }> {
    const summary = {} as any;
    const services = Object.keys(PERFORMANCE_CONFIG.slas) as (keyof ServiceSLAs)[];

    for (const service of services) {
      const recentMetrics = this.getMetrics(1).filter(m => m.service === service);
      const latest = recentMetrics[recentMetrics.length - 1];

      if (latest) {
        const sla = getSLATarget(service);
        const rtHealth = isPerformanceHealthy(service, 'responseTime', latest.responseTime.p95);
        const erHealth = isPerformanceHealthy(service, 'errorRate', latest.errorRate);

        summary[service] = {
          target: sla,
          current: {
            responseTime: latest.responseTime,
            errorRate: latest.errorRate,
            availability: latest.availability,
          },
          status: rtHealth.healthy && erHealth.healthy ? 'healthy' : rtHealth.level,
        };
      } else {
        summary[service] = {
          target: getSLATarget(service),
          current: null,
          status: 'healthy' as const,
        };
      }
    }

    return summary;
  }

  /**
   * @method resetCounters
   * @description 重置计数器 (用于测试)
   */
  resetCounters(): void {
    this.requestCount = 0;
    this.errorCount = 0;
    this.responseTimes = [];
  }
}
