/**
 * Sira AI网关 - 用户用量统计和分析模块
 * 收集、分析和报告API使用情况、成本消耗、用户行为等
 */

const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');

class UsageAnalytics extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            dataDir: options.dataDir || path.join(process.cwd(), 'data', 'analytics'),
            retentionDays: options.retentionDays || 90,
            enableRealTime: options.enableRealTime !== false,
            enablePersistence: options.enablePersistence !== false,
            ...options
        };

        // 统计数据存储
        this.stats = {
            requests: new Map(),           // 请求统计
            users: new Map(),             // 用户统计
            providers: new Map(),         // 供应商统计
            models: new Map(),            // 模型统计
            costs: new Map(),             // 成本统计
            errors: new Map(),            // 错误统计
            performance: new Map(),       // 性能统计
            hourlyStats: new Map(),       // 小时统计
            dailyStats: new Map()         // 日统计
        };

        // 缓存数据
        this.cache = new Map();
        this.cacheTTL = 5 * 60 * 1000; // 5分钟缓存

        // 初始化
        this.initialize();
    }

    /**
     * 初始化统计模块
     */
    async initialize() {
        try {
            // 创建数据目录
            await fs.mkdir(this.options.dataDir, { recursive: true });

            // 加载历史数据
            if (this.options.enablePersistence) {
                await this.loadHistoricalData();
            }

            // 启动定时任务
            this.startScheduledTasks();

            this.emit('initialized');
            console.log('✅ 用量统计模块初始化完成');
        } catch (error) {
            console.error('❌ 用量统计模块初始化失败:', error);
            this.emit('error', error);
        }
    }

    /**
     * 记录API请求
     */
    recordRequest(requestData) {
        const {
            userId,
            provider,
            model,
            tokens,
            cost,
            responseTime,
            statusCode,
            error,
            timestamp = new Date(),
            requestSize,
            responseSize,
            ip,
            userAgent
        } = requestData;

        const hour = this.getHourKey(timestamp);
        const day = this.getDayKey(timestamp);

        // 全局请求统计
        this.incrementCounter(this.stats.requests, 'total');
        this.incrementCounter(this.stats.requests, `status_${statusCode}`);
        this.addToCounter(this.stats.requests, 'tokens', tokens || 0);
        this.addToCounter(this.stats.requests, 'cost', cost || 0);

        // 用户统计
        if (userId) {
            this.incrementCounter(this.stats.users, userId);
            this.addToCounter(this.stats.users, `${userId}_tokens`, tokens || 0);
            this.addToCounter(this.stats.users, `${userId}_cost`, cost || 0);
            this.addToCounter(this.stats.users, `${userId}_requests`, 1);
        }

        // 供应商统计
        if (provider) {
            this.incrementCounter(this.stats.providers, provider);
            this.addToCounter(this.stats.providers, `${provider}_tokens`, tokens || 0);
            this.addToCounter(this.stats.providers, `${provider}_cost`, cost || 0);
            this.addToCounter(this.stats.providers, `${provider}_requests`, 1);
        }

        // 模型统计
        if (model) {
            this.incrementCounter(this.stats.models, model);
            this.addToCounter(this.stats.models, `${model}_tokens`, tokens || 0);
            this.addToCounter(this.stats.models, `${model}_cost`, cost || 0);
            this.addToCounter(this.stats.models, `${model}_requests`, 1);
        }

        // 错误统计
        if (error || statusCode >= 400) {
            this.incrementCounter(this.stats.errors, error || `http_${statusCode}`);
            if (provider) {
                this.incrementCounter(this.stats.errors, `${provider}_errors`);
            }
        }

        // 性能统计
        if (responseTime) {
            this.recordPerformance(provider, model, responseTime, statusCode);
        }

        // 小时统计
        this.recordHourly(hour, {
            requests: 1,
            tokens: tokens || 0,
            cost: cost || 0,
            errors: (error || statusCode >= 400) ? 1 : 0
        });

        // 日统计
        this.recordDaily(day, {
            requests: 1,
            tokens: tokens || 0,
            cost: cost || 0,
            errors: (error || statusCode >= 400) ? 1 : 0,
            users: userId ? 1 : 0
        });

        // 触发事件
        this.emit('request', {
            userId,
            provider,
            model,
            tokens,
            cost,
            responseTime,
            statusCode,
            timestamp
        });

        // 实时持久化
        if (this.options.enableRealTime && Math.random() < 0.1) { // 10%概率实时保存
            this.persistData();
        }
    }

    /**
     * 记录性能数据
     */
    recordPerformance(provider, model, responseTime, statusCode) {
        const key = `${provider}:${model}`;

        if (!this.stats.performance.has(key)) {
            this.stats.performance.set(key, {
                count: 0,
                totalTime: 0,
                avgTime: 0,
                minTime: Infinity,
                maxTime: 0,
                p95Time: 0,
                p99Time: 0,
                successCount: 0,
                errorCount: 0,
                times: []
            });
        }

        const perf = this.stats.performance.get(key);
        perf.count++;
        perf.totalTime += responseTime;
        perf.avgTime = perf.totalTime / perf.count;
        perf.minTime = Math.min(perf.minTime, responseTime);
        perf.maxTime = Math.max(perf.maxTime, responseTime);

        if (statusCode < 400) {
            perf.successCount++;
        } else {
            perf.errorCount++;
        }

        // 保留最近1000个响应时间用于计算百分位数
        perf.times.push(responseTime);
        if (perf.times.length > 1000) {
            perf.times.shift();
        }

        // 计算百分位数
        if (perf.times.length >= 10) {
            const sorted = [...perf.times].sort((a, b) => a - b);
            perf.p95Time = sorted[Math.floor(sorted.length * 0.95)];
            perf.p99Time = sorted[Math.floor(sorted.length * 0.99)];
        }
    }

    /**
     * 记录小时统计
     */
    recordHourly(hour, data) {
        if (!this.stats.hourlyStats.has(hour)) {
            this.stats.hourlyStats.set(hour, {
                requests: 0,
                tokens: 0,
                cost: 0,
                errors: 0,
                startTime: hour
            });
        }

        const hourly = this.stats.hourlyStats.get(hour);
        hourly.requests += data.requests || 0;
        hourly.tokens += data.tokens || 0;
        hourly.cost += data.cost || 0;
        hourly.errors += data.errors || 0;
    }

    /**
     * 记录日统计
     */
    recordDaily(day, data) {
        if (!this.stats.dailyStats.has(day)) {
            this.stats.dailyStats.set(day, {
                requests: 0,
                tokens: 0,
                cost: 0,
                errors: 0,
                users: 0,
                startTime: day
            });
        }

        const daily = this.stats.dailyStats.get(day);
        daily.requests += data.requests || 0;
        daily.tokens += data.tokens || 0;
        daily.cost += data.cost || 0;
        daily.errors += data.errors || 0;
        daily.users += data.users || 0;
    }

    /**
     * 获取统计数据
     */
    getStats(options = {}) {
        const {
            userId,
            provider,
            model,
            startDate,
            endDate,
            groupBy = 'total'
        } = options;

        let result = {};

        switch (groupBy) {
            case 'user':
                result = this.getUserStats(userId, startDate, endDate);
                break;
            case 'provider':
                result = this.getProviderStats(provider, startDate, endDate);
                break;
            case 'model':
                result = this.getModelStats(model, startDate, endDate);
                break;
            case 'hourly':
                result = this.getHourlyStats(startDate, endDate);
                break;
            case 'daily':
                result = this.getDailyStats(startDate, endDate);
                break;
            default:
                result = this.getGlobalStats(startDate, endDate);
        }

        return result;
    }

    /**
     * 获取全局统计
     */
    getGlobalStats(startDate, endDate) {
        const filteredHourly = this.filterByDateRange(this.stats.hourlyStats, startDate, endDate);

        return {
            summary: {
                totalRequests: Array.from(filteredHourly.values()).reduce((sum, h) => sum + h.requests, 0),
                totalTokens: Array.from(filteredHourly.values()).reduce((sum, h) => sum + h.tokens, 0),
                totalCost: Array.from(filteredHourly.values()).reduce((sum, h) => sum + h.cost, 0),
                totalErrors: Array.from(filteredHourly.values()).reduce((sum, h) => sum + h.errors, 0),
                uniqueUsers: new Set(Array.from(filteredHourly.values()).map(h => h.users)).size
            },
            topUsers: this.getTopItems(this.stats.users, 10, 'requests'),
            topProviders: this.getTopItems(this.stats.providers, 10, 'requests'),
            topModels: this.getTopItems(this.stats.models, 10, 'requests'),
            errorRate: this.calculateErrorRate(filteredHourly),
            avgResponseTime: this.calculateAvgResponseTime(),
            costPerToken: this.calculateCostPerToken()
        };
    }

    /**
     * 获取用户统计
     */
    getUserStats(userId, startDate, endDate) {
        if (!userId) {
            return {
                users: Array.from(this.stats.users.entries())
                    .filter(([key]) => !key.includes('_'))
                    .map(([userId, count]) => ({
                        userId,
                        requests: count,
                        tokens: this.stats.users.get(`${userId}_tokens`) || 0,
                        cost: this.stats.users.get(`${userId}_cost`) || 0
                    }))
                    .sort((a, b) => b.requests - a.requests)
                    .slice(0, 50)
            };
        }

        return {
            userId,
            requests: this.stats.users.get(userId) || 0,
            tokens: this.stats.users.get(`${userId}_tokens`) || 0,
            cost: this.stats.users.get(`${userId}_cost`) || 0,
            lastActivity: new Date().toISOString()
        };
    }

    /**
     * 获取供应商统计
     */
    getProviderStats(provider, startDate, endDate) {
        const providers = {};

        for (const [key, value] of this.stats.providers) {
            if (!key.includes('_')) {
                providers[key] = {
                    requests: value,
                    tokens: this.stats.providers.get(`${key}_tokens`) || 0,
                    cost: this.stats.providers.get(`${key}_cost`) || 0,
                    errors: this.stats.errors.get(`${key}_errors`) || 0
                };
            }
        }

        if (provider) {
            return providers[provider] || {};
        }

        return { providers };
    }

    /**
     * 获取模型统计
     */
    getModelStats(model, startDate, endDate) {
        const models = {};

        for (const [key, value] of this.stats.models) {
            if (!key.includes('_')) {
                models[key] = {
                    requests: value,
                    tokens: this.stats.models.get(`${key}_tokens`) || 0,
                    cost: this.stats.models.get(`${key}_cost`) || 0
                };
            }
        }

        if (model) {
            return models[model] || {};
        }

        return { models };
    }

    /**
     * 获取小时统计
     */
    getHourlyStats(startDate, endDate) {
        const filtered = this.filterByDateRange(this.stats.hourlyStats, startDate, endDate);
        return {
            hourly: Array.from(filtered.entries())
                .sort(([a], [b]) => a.localeCompare(b))
        };
    }

    /**
     * 获取日统计
     */
    getDailyStats(startDate, endDate) {
        const filtered = this.filterByDateRange(this.stats.dailyStats, startDate, endDate);
        return {
            daily: Array.from(filtered.entries())
                .sort(([a], [b]) => a.localeCompare(b))
        };
    }

    /**
     * 生成报告
     */
    async generateReport(options = {}) {
        const {
            type = 'summary',
            format = 'json',
            startDate,
            endDate,
            outputPath
        } = options;

        let report = {};

        switch (type) {
            case 'summary':
                report = this.getStats({ startDate, endDate });
                break;
            case 'users':
                report = this.getStats({ groupBy: 'user', startDate, endDate });
                break;
            case 'providers':
                report = this.getStats({ groupBy: 'provider', startDate, endDate });
                break;
            case 'models':
                report = this.getStats({ groupBy: 'model', startDate, endDate });
                break;
            case 'performance':
                report = this.getPerformanceReport();
                break;
        }

        // 添加元数据
        report.metadata = {
            generatedAt: new Date().toISOString(),
            type,
            dateRange: { startDate, endDate },
            version: '1.0.0'
        };

        // 保存到文件
        if (outputPath) {
            const content = format === 'json'
                ? JSON.stringify(report, null, 2)
                : this.formatAsMarkdown(report);

            await fs.writeFile(outputPath, content, 'utf8');
            console.log(`📄 报告已保存到: ${outputPath}`);
        }

        return report;
    }

    /**
     * 获取性能报告
     */
    getPerformanceReport() {
        const performance = {};

        for (const [key, perf] of this.stats.performance) {
            const [provider, model] = key.split(':');
            if (!performance[provider]) {
                performance[provider] = {};
            }
            performance[provider][model] = {
                avgResponseTime: Math.round(perf.avgTime),
                minResponseTime: perf.minTime,
                maxResponseTime: perf.maxTime,
                p95ResponseTime: perf.p95Time,
                p99ResponseTime: perf.p99Time,
                successRate: perf.count > 0 ? (perf.successCount / perf.count * 100).toFixed(2) + '%' : '0%',
                totalRequests: perf.count
            };
        }

        return { performance };
    }

    /**
     * 工具方法
     */
    incrementCounter(map, key) {
        map.set(key, (map.get(key) || 0) + 1);
    }

    addToCounter(map, key, value) {
        map.set(key, (map.get(key) || 0) + value);
    }

    getHourKey(timestamp) {
        const date = new Date(timestamp);
        return date.toISOString().slice(0, 13); // YYYY-MM-DDTHH
    }

    getDayKey(timestamp) {
        const date = new Date(timestamp);
        return date.toISOString().slice(0, 10); // YYYY-MM-DD
    }

    filterByDateRange(dataMap, startDate, endDate) {
        if (!startDate && !endDate) return dataMap;

        const filtered = new Map();
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;

        for (const [key, value] of dataMap) {
            const keyDate = new Date(key);
            if ((!start || keyDate >= start) && (!end || keyDate <= end)) {
                filtered.set(key, value);
            }
        }

        return filtered;
    }

    getTopItems(dataMap, limit, sortBy) {
        return Array.from(dataMap.entries())
            .filter(([key]) => !key.includes('_'))
            .map(([key, count]) => ({
                item: key,
                count,
                tokens: dataMap.get(`${key}_tokens`) || 0,
                cost: dataMap.get(`${key}_cost`) || 0
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);
    }

    calculateErrorRate(hourlyStats) {
        const totalRequests = Array.from(hourlyStats.values()).reduce((sum, h) => sum + h.requests, 0);
        const totalErrors = Array.from(hourlyStats.values()).reduce((sum, h) => sum + h.errors, 0);

        return totalRequests > 0 ? ((totalErrors / totalRequests) * 100).toFixed(2) + '%' : '0%';
    }

    calculateAvgResponseTime() {
        const performances = Array.from(this.stats.performance.values());
        if (performances.length === 0) return 0;

        const totalTime = performances.reduce((sum, p) => sum + p.totalTime, 0);
        const totalCount = performances.reduce((sum, p) => sum + p.count, 0);

        return totalCount > 0 ? Math.round(totalTime / totalCount) : 0;
    }

    calculateCostPerToken() {
        const totalTokens = Array.from(this.stats.requests.values()).find((_, key) => key === 'tokens') || 0;
        const totalCost = Array.from(this.stats.requests.values()).find((_, key) => key === 'cost') || 0;

        return totalTokens > 0 ? (totalCost / totalTokens * 1000).toFixed(4) : 0;
    }

    /**
     * 数据持久化
     */
    async persistData() {
        if (!this.options.enablePersistence) return;

        try {
            const dataPath = path.join(this.options.dataDir, 'usage-stats.json');
            const data = {
                timestamp: new Date().toISOString(),
                stats: Object.fromEntries(
                    Object.entries(this.stats).map(([key, map]) => [
                        key,
                        Object.fromEntries(map)
                    ])
                )
            };

            await fs.writeFile(dataPath, JSON.stringify(data, null, 2), 'utf8');
        } catch (error) {
            console.error('❌ 统计数据持久化失败:', error);
        }
    }

    /**
     * 加载历史数据
     */
    async loadHistoricalData() {
        try {
            const dataPath = path.join(this.options.dataDir, 'usage-stats.json');

            const exists = await fs.access(dataPath).then(() => true).catch(() => false);
            if (!exists) return;

            const data = JSON.parse(await fs.readFile(dataPath, 'utf8'));

            // 恢复统计数据
            for (const [category, categoryData] of Object.entries(data.stats)) {
                for (const [key, value] of Object.entries(categoryData)) {
                    this.stats[category].set(key, value);
                }
            }

            console.log('✅ 历史统计数据已加载');
        } catch (error) {
            console.error('❌ 加载历史统计数据失败:', error);
        }
    }

    /**
     * 清理过期数据
     */
    async cleanupOldData() {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.options.retentionDays);

        // 清理小时统计
        for (const [key] of this.stats.hourlyStats) {
            if (new Date(key) < cutoffDate) {
                this.stats.hourlyStats.delete(key);
            }
        }

        // 清理日统计
        for (const [key] of this.stats.dailyStats) {
            if (new Date(key) < cutoffDate) {
                this.stats.dailyStats.delete(key);
            }
        }
    }

    /**
     * 启动定时任务
     */
    startScheduledTasks() {
        // 每5分钟持久化数据
        setInterval(() => {
            this.persistData();
        }, 5 * 60 * 1000);

        // 每天清理过期数据
        setInterval(() => {
            this.cleanupOldData();
        }, 24 * 60 * 60 * 1000);

        // 每小时生成摘要报告
        setInterval(async () => {
            const reportPath = path.join(this.options.dataDir, `summary-${new Date().toISOString().slice(0, 13)}.json`);
            await this.generateReport({
                type: 'summary',
                outputPath: reportPath
            });
        }, 60 * 60 * 1000);
    }

    /**
     * 格式化为Markdown
     */
    formatAsMarkdown(report) {
        let markdown = `# Sira AI网关 - 用量统计报告\n\n`;
        markdown += `**生成时间**: ${report.metadata.generatedAt}\n\n`;

        if (report.summary) {
            markdown += `## 📊 全局统计\n\n`;
            markdown += `- 总请求数: ${report.summary.totalRequests}\n`;
            markdown += `- 总Token数: ${report.summary.totalTokens}\n`;
            markdown += `- 总成本: ¥${report.summary.totalCost.toFixed(2)}\n`;
            markdown += `- 错误率: ${report.summary.errorRate}\n`;
            markdown += `- 活跃用户: ${report.summary.uniqueUsers}\n\n`;
        }

        // 可以继续添加其他部分的格式化

        return markdown;
    }
}

// 创建全局实例
const usageAnalytics = new UsageAnalytics();

// 导出类和实例
module.exports = {
    UsageAnalytics,
    usageAnalytics
};
