/**
 * LOW-8: Structured Logger
 *
 * Provides JSON-structured logging for production observability.
 * Replaces ad-hoc console.log/warn/error with a consistent format that
 * integrates with log aggregation tools (Datadog, CloudWatch, etc.).
 *
 * Usage:
 *   import { logger } from './lib/logger.js';
 *   logger.info('Hold created', { holdId, tourId, sessionId });
 *   logger.warn('Payment overdue', { paymentId, age: '48h' });
 *   logger.error('DB write failed', { error: err.message, bookingId });
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    service: string;
    message: string;
    [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

class Logger {
    private service: string;
    private minLevel: LogLevel;

    constructor(service: string = 'ace-tours', minLevel?: LogLevel) {
        this.service = service;
        this.minLevel = minLevel || (process.env.LOG_LEVEL as LogLevel) || 'info';
    }

    private shouldLog(level: LogLevel): boolean {
        return LOG_LEVELS[level] >= LOG_LEVELS[this.minLevel];
    }

    private formatEntry(level: LogLevel, message: string, meta?: Record<string, unknown>): LogEntry {
        return {
            timestamp: new Date().toISOString(),
            level,
            service: this.service,
            message,
            ...meta,
        };
    }

    private emit(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
        if (!this.shouldLog(level)) return;

        const entry = this.formatEntry(level, message, meta);

        // In production, output JSON for log aggregators; in dev, use readable format
        if (process.env.NODE_ENV === 'production') {
            const output = JSON.stringify(entry);
            switch (level) {
                case 'error':
                    console.error(output);
                    break;
                case 'warn':
                    console.warn(output);
                    break;
                default:
                    console.log(output);
            }
        } else {
            // Human-readable dev format
            const prefix = `[${entry.timestamp}] [${level.toUpperCase()}] [${this.service}]`;
            const metaStr = meta && Object.keys(meta).length > 0
                ? ' ' + JSON.stringify(meta)
                : '';
            switch (level) {
                case 'error':
                    console.error(`${prefix} ${message}${metaStr}`);
                    break;
                case 'warn':
                    console.warn(`${prefix} ${message}${metaStr}`);
                    break;
                default:
                    console.log(`${prefix} ${message}${metaStr}`);
            }
        }
    }

    debug(message: string, meta?: Record<string, unknown>): void {
        this.emit('debug', message, meta);
    }

    info(message: string, meta?: Record<string, unknown>): void {
        this.emit('info', message, meta);
    }

    warn(message: string, meta?: Record<string, unknown>): void {
        this.emit('warn', message, meta);
    }

    error(message: string, meta?: Record<string, unknown>): void {
        this.emit('error', message, meta);
    }

    /** Create a child logger with a specific service/component name */
    child(component: string): Logger {
        return new Logger(`${this.service}:${component}`, this.minLevel);
    }
}

/** Default application-wide logger instance */
export const logger = new Logger('ace-tours');

/** Create a component-specific logger */
export function createLogger(component: string): Logger {
    return logger.child(component);
}

export { Logger };
