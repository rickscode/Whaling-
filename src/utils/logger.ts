import { LOG_LEVEL } from '../config/constants';

enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

const levelMap: Record<string, LogLevel> = {
    debug: LogLevel.DEBUG,
    info: LogLevel.INFO,
    warn: LogLevel.WARN,
    error: LogLevel.ERROR
};

const currentLevel = levelMap[LOG_LEVEL.toLowerCase()] || LogLevel.INFO;

function getTimestamp(): string {
    return new Date().toISOString();
}

function shouldLog(level: LogLevel): boolean {
    return level >= currentLevel;
}

export const logger = {
    debug(message: string, ...args: any[]): void {
        if (shouldLog(LogLevel.DEBUG)) {
            console.log(`[${getTimestamp()}] [DEBUG]`, message, ...args);
        }
    },

    info(message: string, ...args: any[]): void {
        if (shouldLog(LogLevel.INFO)) {
            console.log(`[${getTimestamp()}] [INFO]`, message, ...args);
        }
    },

    warn(message: string, ...args: any[]): void {
        if (shouldLog(LogLevel.WARN)) {
            console.warn(`[${getTimestamp()}] [WARN]`, message, ...args);
        }
    },

    error(message: string, ...args: any[]): void {
        if (shouldLog(LogLevel.ERROR)) {
            console.error(`[${getTimestamp()}] [ERROR]`, message, ...args);
        }
    }
};
