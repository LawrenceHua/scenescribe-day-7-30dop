type LogMethod = (...args: unknown[]) => void;

interface Logger {
  info: LogMethod;
  warn: LogMethod;
  error: LogMethod;
  track: (event: string, data?: Record<string, unknown>) => void;
}

const isDev = process.env.NODE_ENV !== "production";

const consoleLogger = console;

const createLogger = (): Logger => ({
  info: (...args) => {
    if (isDev) {
      consoleLogger.info(...args);
    }
  },
  warn: (...args) => {
    if (isDev) {
      consoleLogger.warn(...args);
    }
  },
  error: (...args) => {
    consoleLogger.error(...args);
  },
  track: (event, data = {}) => {
    if (isDev) {
      consoleLogger.info(`[TRACK] ${event}`, data);
    }
    // Placeholder hook for future analytics piping
  },
});

declare global {
  // eslint-disable-next-line no-var
  var __appLogger: Logger | undefined;
}

if (!globalThis.__appLogger) {
  globalThis.__appLogger = createLogger();
}

export const logger = globalThis.__appLogger;

