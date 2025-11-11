import winston from 'winston';
import path from 'path';

const logLevel = process.env.LOG_LEVEL || 'info';

/**
 * Custom log format
 */
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;

    let logMessage = `${timestamp} [${level.toUpperCase()}]: ${message}`;

    if (Object.keys(meta).length > 0) {
      // Remove stack from meta if it exists (it's already in message)
      const { stack, ...restMeta } = meta;
      if (Object.keys(restMeta).length > 0) {
        logMessage += ` ${JSON.stringify(restMeta)}`;
      }
      if (stack && process.env.NODE_ENV === 'development') {
        logMessage += `\n${stack}`;
      }
    }

    return logMessage;
  })
);

/**
 * Logger configuration
 */
export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'medicine-man-api' },
  transports: [
    // Error logs
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),

    // Combined logs
    new winston.transports.File({
      filename: path.join('logs', 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
  ],
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: customFormat,
    })
  );
} else {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        customFormat
      ),
    })
  );
}

/**
 * Request logger middleware
 * SECURITY: Anonymized logging - IP addresses and user-agents are NOT logged by default
 *
 * Privacy Protection:
 * - IP addresses can identify users and their physical locations
 * - User-agent strings can be used for browser fingerprinting
 * - Both are removed by default to ensure user anonymity
 *
 * Optional Environment Variables:
 * - LOG_IP=true: Enable IP address logging (default: false)
 * - LOG_USER_AGENT=true: Enable user-agent logging (default: false)
 */
export const requestLogger = (req: any, res: any, next: any) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { method, originalUrl } = req;
    const { statusCode } = res;

    const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

    // Sanitize URL to remove sensitive query parameters
    const sanitizedUrl = originalUrl.replace(/([?&])(password|token|key|secret)=[^&]*/gi, '$1$2=***');

    // Extract IP if logging is enabled
    const ip = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress;

    logger.log(logLevel, `${method} ${sanitizedUrl}`, {
      requestId: req.id, // Add request ID for tracing
      method,
      url: sanitizedUrl,
      statusCode,
      duration: `${duration}ms`,
      // IP and user-agent removed by default for privacy/anonymity
      // Only include if explicitly enabled via environment variables
      ...(process.env.LOG_IP === 'true' && { ip }),
      ...(process.env.LOG_USER_AGENT === 'true' && { userAgent: req.get('user-agent') }),
    });
  });

  next();
};

export default logger;
