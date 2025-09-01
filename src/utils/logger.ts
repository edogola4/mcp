import winston, { Logger } from 'winston';
import path from 'path';
import config from '../config';
import 'winston-daily-rotate-file';

const { combine, timestamp, printf, colorize, json } = winston.format;

// Define log format
const logFormat = printf(({ level, message, timestamp, ...meta }) => {
  let log = `${timestamp} [${level}]: ${message}`;
  
  // Add metadata if present
  const metaString = Object.keys(meta).length > 0 
    ? '\n' + JSON.stringify(meta, null, 2) 
    : '';
  
  return log + metaString;
});

// Create logs directory if it doesn't exist
const ensureLogsDirectory = (filePath: string): string => {
  const logsDir = path.dirname(filePath);
  try {
    require('fs').mkdirSync(logsDir, { recursive: true });
  } catch (error) {
    console.error('Failed to create logs directory:', error);
  }
  return filePath;
};

// Create console transport
const consoleTransport = new winston.transports.Console({
  format: combine(
    colorize(),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
});

// Get log file path with fallback
const getLogFilePath = () => {
  try {
    return ensureLogsDirectory(config?.logger?.file || './logs/app.log').replace(/\.log$/, '');
  } catch (error) {
    console.error('Error getting log file path:', error);
    return ensureLogsDirectory('./logs/app.log').replace(/\.log$/, '');
  }
};

// Create file transport
const fileTransport = new winston.transports.DailyRotateFile({
  filename: getLogFilePath(),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d', // Keep logs for 14 days
  format: combine(
    timestamp(),
    json()
  ),
  level: config.logger.level,
});

// Create logger instance
const logger: Logger = winston.createLogger({
  level: config.logger.level,
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    json()
  ),
  transports: [
    consoleTransport,
    fileTransport
  ],
  exitOnError: false
});

// Handle uncaught exceptions
if (process.env.NODE_ENV !== 'test') {
  logger.exceptions.handle(
    new winston.transports.File({ 
      filename: ensureLogsDirectory('logs/exceptions.log') 
    })
  );

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason) => {
    throw reason;
  });
}

// Create a stream for morgan (HTTP request logging)
export const stream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

export default logger;
