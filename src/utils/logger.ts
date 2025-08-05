/**
 * 统一日志管理系统
 * 生产级别的日志管理，支持不同级别、格式化输出、性能监控
 */

// 日志级别枚举
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

// 日志配置接口
interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableStorage: boolean;
  maxStorageSize: number;
  enablePerformanceTracking: boolean;
  enableStackTrace: boolean;
  prefix?: string;
}

// 日志条目接口
interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  data?: any;
  stack?: string;
  performance?: {
    memory?: number;
    timing?: number;
  };
  context?: string;
}

// 性能监控接口
interface PerformanceTracker {
  start(label: string): void;
  end(label: string): number;
  getMetrics(): Record<string, number>;
}

/**
 * 高性能日志管理器
 */
export class Logger {
  private static instance: Logger;
  private config: LoggerConfig;
  private logBuffer: LogEntry[] = [];
  private performanceTracker: PerformanceTracker;
  private readonly MAX_BUFFER_SIZE = 1000;

  // 默认配置
  private static readonly DEFAULT_CONFIG: LoggerConfig = {
    level: import.meta.env.PROD ? LogLevel.WARN : LogLevel.DEBUG,
    enableConsole: !import.meta.env.PROD,
    enableStorage: false,
    maxStorageSize: 100, // 最多存储100条日志
    enablePerformanceTracking: true,
    enableStackTrace: false,
  };

  private constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...Logger.DEFAULT_CONFIG, ...config };
    this.performanceTracker = this.createPerformanceTracker();
    this.initializeLogger();
  }

  /**
   * 获取单例实例
   */
  static getInstance(config?: Partial<LoggerConfig>): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config);
    }
    return Logger.instance;
  }

  /**
   * 创建性能追踪器
   */
  private createPerformanceTracker(): PerformanceTracker {
    const timings = new Map<string, number>();

    return {
      start: (label: string) => {
        timings.set(label, performance.now());
      },

      end: (label: string) => {
        const startTime = timings.get(label);
        if (startTime) {
          const duration = performance.now() - startTime;
          timings.delete(label);
          return duration;
        }
        return 0;
      },

      getMetrics: () => {
        const metrics: Record<string, number> = {};
        timings.forEach((time, label) => {
          metrics[label] = performance.now() - time;
        });
        return metrics;
      },
    };
  }

  /**
   * 初始化日志系统
   */
  private initializeLogger(): void {
    // 定期清理日志缓冲区
    if (typeof window !== "undefined") {
      setInterval(() => {
        this.flushLogs();
      }, 30000); // 每30秒清理一次

      // 页面卸载时保存日志
      window.addEventListener("beforeunload", () => {
        this.flushLogs();
      });
    }
  }

  /**
   * 格式化日志消息
   */
  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    const prefix = this.config.prefix ? `[${this.config.prefix}]` : "";

    let formatted = `${timestamp} ${prefix}[${levelName}] ${message}`;

    if (data !== undefined) {
      formatted += ` | Data: ${this.serializeData(data)}`;
    }

    return formatted;
  }

  /**
   * 安全序列化数据
   */
  private serializeData(data: any): string {
    try {
      if (typeof data === "string") return data;
      if (typeof data === "number" || typeof data === "boolean")
        return String(data);

      // 处理循环引用
      const seen = new WeakSet();
      return JSON.stringify(
        data,
        (key, value) => {
          if (typeof value === "object" && value !== null) {
            if (seen.has(value)) {
              return "[Circular Reference]";
            }
            seen.add(value);
          }
          return value;
        },
        2
      );
    } catch (error) {
      return `[Serialization Error: ${error}]`;
    }
  }

  /**
   * 获取调用栈信息
   */
  private getStackTrace(): string {
    if (!this.config.enableStackTrace) return "";

    try {
      const stack = new Error().stack;
      if (stack) {
        // 移除Logger相关的调用栈
        const lines = stack.split("\n").slice(3, 6);
        return lines.join("\n");
      }
    } catch (error) {
      // 忽略错误
    }
    return "";
  }

  /**
   * 获取性能信息
   */
  private getPerformanceInfo():
    | { memory?: number; timing?: number }
    | undefined {
    if (!this.config.enablePerformanceTracking) return undefined;

    const info: { memory?: number; timing?: number } = {};

    // 获取内存使用情况
    if ("memory" in performance) {
      const memory = (performance as any).memory;
      info.memory = memory.usedJSHeapSize;
    }

    return info;
  }

  /**
   * 核心日志方法
   */
  private log(
    level: LogLevel,
    message: string,
    data?: any,
    context?: string
  ): void {
    // 检查日志级别
    if (level < this.config.level) return;

    const logEntry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      data,
      stack: this.getStackTrace(),
      performance: this.getPerformanceInfo(),
      context,
    };

    // 添加到缓冲区
    this.logBuffer.push(logEntry);

    // 控制缓冲区大小
    if (this.logBuffer.length > this.MAX_BUFFER_SIZE) {
      this.logBuffer = this.logBuffer.slice(-this.MAX_BUFFER_SIZE / 2);
    }

    // 控制台输出
    if (this.config.enableConsole) {
      this.outputToConsole(logEntry);
    }

    // 存储到localStorage（如果启用）
    if (this.config.enableStorage) {
      this.saveToStorage(logEntry);
    }
  }

  /**
   * 输出到控制台
   */
  private outputToConsole(entry: LogEntry): void {
    const formatted = this.formatMessage(
      entry.level,
      entry.message,
      entry.data
    );

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(formatted);
        break;
      case LogLevel.INFO:
        console.info(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      case LogLevel.ERROR:
        console.error(formatted);
        if (entry.stack) console.error(entry.stack);
        break;
    }
  }

  /**
   * 保存到本地存储
   */
  private saveToStorage(entry: LogEntry): void {
    try {
      const storageKey = "app_logs";
      const existingLogs = JSON.parse(localStorage.getItem(storageKey) || "[]");

      existingLogs.push(entry);

      // 限制存储大小
      if (existingLogs.length > this.config.maxStorageSize) {
        existingLogs.splice(
          0,
          existingLogs.length - this.config.maxStorageSize
        );
      }

      localStorage.setItem(storageKey, JSON.stringify(existingLogs));
    } catch (error) {
      // 存储失败时静默处理
    }
  }

  /**
   * 清理日志缓冲区
   */
  private flushLogs(): void {
    if (this.logBuffer.length > 500) {
      this.logBuffer = this.logBuffer.slice(-250);
    }
  }

  // 公共API方法
  debug(message: string, data?: any, context?: string): void {
    this.log(LogLevel.DEBUG, message, data, context);
  }

  info(message: string, data?: any, context?: string): void {
    this.log(LogLevel.INFO, message, data, context);
  }

  warn(message: string, data?: any, context?: string): void {
    this.log(LogLevel.WARN, message, data, context);
  }

  error(message: string, data?: any, context?: string): void {
    this.log(LogLevel.ERROR, message, data, context);
  }

  /**
   * 性能监控方法
   */
  startTimer(label: string): void {
    this.performanceTracker.start(label);
  }

  endTimer(label: string): number {
    const duration = this.performanceTracker.end(label);
    this.debug(`Performance: ${label} took ${duration.toFixed(2)}ms`);
    return duration;
  }

  /**
   * 获取日志统计
   */
  getStats(): any {
    const stats = {
      totalLogs: this.logBuffer.length,
      byLevel: {
        debug: 0,
        info: 0,
        warn: 0,
        error: 0,
      },
      performanceMetrics: this.performanceTracker.getMetrics(),
    };

    this.logBuffer.forEach((entry) => {
      const levelName = LogLevel[
        entry.level
      ].toLowerCase() as keyof typeof stats.byLevel;
      if (levelName in stats.byLevel) {
        stats.byLevel[levelName]++;
      }
    });

    return stats;
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 获取最近的日志
   */
  getRecentLogs(count: number = 50): LogEntry[] {
    return this.logBuffer.slice(-count);
  }

  /**
   * 清除所有日志
   */
  clearLogs(): void {
    this.logBuffer = [];
    localStorage.removeItem("app_logs");
  }
}

// 创建默认实例
export const logger = Logger.getInstance();

// 便捷的全局日志函数
export const log = {
  debug: (message: string, data?: any, context?: string) =>
    logger.debug(message, data, context),
  info: (message: string, data?: any, context?: string) =>
    logger.info(message, data, context),
  warn: (message: string, data?: any, context?: string) =>
    logger.warn(message, data, context),
  error: (message: string, data?: any, context?: string) =>
    logger.error(message, data, context),
  startTimer: (label: string) => logger.startTimer(label),
  endTimer: (label: string) => logger.endTimer(label),
};
