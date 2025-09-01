import { z } from 'zod';

// Define schema for security configuration
const SecurityConfigSchema = z.object({
  // OAuth Configuration
  oauth: z.object({
    enabled: z.boolean().default(false),
    issuerUrl: z.string().url().default('https://accounts.google.com'),
    clientId: z.string().default(''),
    clientSecret: z.string().default(''),
    redirectUri: z.string().url().default('http://localhost:3000/auth/callback'),
    scope: z.string().default('openid email profile'),
  }),
  
  // CORS Configuration
  cors: z.object({
    enabled: z.boolean().default(true),
    allowedOrigins: z.array(z.string().url())
      .default([
        'http://localhost:5173',
        'http://localhost:5174',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:5174',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
      ]),
    methods: z.array(z.string())
      .default(['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']),
    allowedHeaders: z.array(z.string())
      .default(['Content-Type', 'Authorization']),
    credentials: z.boolean().default(true),
    maxAge: z.number().default(600), // 10 minutes
  }),
  
  // Rate Limiting
  rateLimit: z.object({
    enabled: z.boolean().default(true),
    windowMs: z.number().default(15 * 60 * 1000), // 15 minutes
    max: z.number().default(100), // Limit each IP to 100 requests per windowMs
    message: z.string().default('Too many requests, please try again later'),
    trustProxy: z.boolean().default(true),
  }),
  
  // Session Configuration
  session: z.object({
    secret: z.string().min(32, 'Session secret must be at least 32 characters long'),
    name: z.string().default('mcp.sid'),
    resave: z.boolean().default(false),
    saveUninitialized: z.boolean().default(false),
    rolling: z.boolean().default(true),
    cookie: z.object({
      secure: z.boolean().default(process.env.NODE_ENV === 'production'),
      httpOnly: z.boolean().default(true),
      maxAge: z.number().default(7 * 24 * 60 * 60 * 1000), // 7 days
      sameSite: z.enum(['lax', 'strict', 'none']).default('lax'),
      domain: z.string().optional(),
      path: z.string().default('/'),
    }),
  }),
  
  // Security Headers
  headers: z.object({
    hsts: z.object({
      enabled: z.boolean().default(process.env.NODE_ENV === 'production'),
      maxAge: z.number().default(31536000), // 1 year in seconds
      includeSubDomains: z.boolean().default(true),
      preload: z.boolean().default(false),
    }),
    xssFilter: z.boolean().default(true),
    noSniff: z.boolean().default(true),
    hidePoweredBy: z.boolean().default(true),
    frameguard: z.object({
      enabled: z.boolean().default(true),
      action: z.enum(['DENY', 'SAMEORIGIN']).default('SAMEORIGIN'),
    }),
    contentSecurityPolicy: z.object({
      enabled: z.boolean().default(true),
      // Define CSP directives type
      directives: z.record(
        z.string(), // Key is a string
        z.union([z.string(), z.array(z.string())]) // Value can be string or array of strings
      ).default({
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'"],
        'img-src': ["'self'"],
        'connect-src': ["'self'"],
        'font-src': ["'self'"],
        'object-src': ["'none'"],
        'media-src': ["'self'"],
        'frame-src': ["'none'"],
      }),
    }),
  }),
  
  // Password Policy
  passwordPolicy: z.object({
    minLength: z.number().default(12),
    requireUppercase: z.boolean().default(true),
    requireLowercase: z.boolean().default(true),
    requireNumbers: z.boolean().default(true),
    requireSpecialChars: z.boolean().default(true),
    maxAgeDays: z.number().default(90), // Password expiration in days
    historySize: z.number().default(5), // Number of previous passwords to remember
  }),
  
  // JWT Configuration
  jwt: z.object({
    secret: z.string().min(32, 'JWT secret must be at least 32 characters long'),
    algorithm: z.string().default('HS256'),
    expiresIn: z.union([z.string(), z.number()]).default('1d'),
    issuer: z.string().default('mcp-server'),
    audience: z.string().default('mcp-client'),
  }),
  
  // API Security
  apiSecurity: z.object({
    enableRequestValidation: z.boolean().default(true),
    enableResponseValidation: z.boolean().default(true),
    maxRequestSize: z.string().default('1mb'),
    enableQueryValidation: z.boolean().default(true),
    enableParamValidation: z.boolean().default(true),
  }),
  
  // Logging and Monitoring
  logging: z.object({
    enableSecurityLogging: z.boolean().default(true),
    logSensitiveData: z.boolean().default(false),
    logFailedLoginAttempts: z.boolean().default(true),
    logSuccessfulLogins: z.boolean().default(false),
  }),
});

// Export the SecurityConfig type for use in other files
export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;

// Parse environment variables with defaults
const parseEnv = () => ({
  oauth: {
    enabled: process.env.OAUTH_ENABLED === 'true',
    issuerUrl: process.env.OAUTH_ISSUER_URL || 'https://accounts.google.com',
    clientId: process.env.OAUTH_CLIENT_ID || '',
    clientSecret: process.env.OAUTH_CLIENT_SECRET || '',
    redirectUri: process.env.OAUTH_REDIRECT_URI || 'http://localhost:3000/auth/callback',
    scope: process.env.OAUTH_SCOPE || 'openid email profile',
  },
  cors: {
    enabled: process.env.CORS_ENABLED !== 'false',
    allowedOrigins: process.env.CORS_ALLOWED_ORIGINS
      ? process.env.CORS_ALLOWED_ORIGINS.split(',')
      : [
          'http://localhost:5173',
          'http://localhost:5174',
          'http://127.0.0.1:5173',
          'http://127.0.0.1:5174',
          'http://localhost:3000',
          'http://127.0.0.1:3000',
        ],
    methods: process.env.CORS_METHODS 
      ? process.env.CORS_METHODS.split(',').map(m => m.trim()) 
      : ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: process.env.CORS_ALLOWED_HEADERS
      ? process.env.CORS_ALLOWED_HEADERS.split(',').map(h => h.trim())
      : ['Content-Type', 'Authorization'],
    credentials: process.env.CORS_CREDENTIALS !== 'false',
    maxAge: parseInt(process.env.CORS_MAX_AGE || '600', 10),
  },
  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    message: process.env.RATE_LIMIT_MESSAGE || 'Too many requests, please try again later',
    trustProxy: process.env.TRUST_PROXY === 'true',
  },
  session: {
    secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || 'your-secure-session-secret-min-32-chars-long',
    name: process.env.SESSION_NAME || 'mcp.sid',
    resave: process.env.SESSION_RESAVE === 'true',
    saveUninitialized: process.env.SESSION_SAVE_UNINITIALIZED === 'true',
    rolling: process.env.SESSION_ROLLING !== 'false',
    cookie: {
      secure: process.env.SESSION_COOKIE_SECURE
        ? process.env.SESSION_COOKIE_SECURE === 'true'
        : process.env.NODE_ENV === 'production',
      httpOnly: process.env.SESSION_COOKIE_HTTPONLY !== 'false',
      maxAge: parseInt(process.env.SESSION_COOKIE_MAX_AGE || '604800000', 10), // 7 days
      sameSite: (process.env.SESSION_COOKIE_SAME_SITE as 'lax' | 'strict' | 'none') || 'lax',
      domain: process.env.SESSION_COOKIE_DOMAIN,
      path: process.env.SESSION_COOKIE_PATH || '/',
    },
  },
  headers: {
    hsts: {
      enabled: process.env.HSTS_ENABLED
        ? process.env.HSTS_ENABLED === 'true'
        : process.env.NODE_ENV === 'production',
      maxAge: parseInt(process.env.HSTS_MAX_AGE || '31536000', 10),
      includeSubDomains: process.env.HSTS_INCLUDE_SUBDOMAINS !== 'false',
      preload: process.env.HSTS_PRELOAD === 'true',
    },
    xssFilter: process.env.XSS_FILTER !== 'false',
    noSniff: process.env.NO_SNIFF !== 'false',
    hidePoweredBy: process.env.HIDE_POWERED_BY !== 'false',
    frameguard: {
      enabled: process.env.FRAMEGUARD_ENABLED !== 'false',
      action: (process.env.FRAMEGUARD_ACTION as 'DENY' | 'SAMEORIGIN') || 'SAMEORIGIN',
    },
    contentSecurityPolicy: {
      enabled: process.env.CSP_ENABLED !== 'false',
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
  },
  passwordPolicy: {
    minLength: parseInt(process.env.PASSWORD_MIN_LENGTH || '12', 10),
    requireUppercase: process.env.PASSWORD_REQUIRE_UPPERCASE !== 'false',
    requireLowercase: process.env.PASSWORD_REQUIRE_LOWERCASE !== 'false',
    requireNumbers: process.env.PASSWORD_REQUIRE_NUMBERS !== 'false',
    requireSpecialChars: process.env.PASSWORD_REQUIRE_SPECIAL_CHARS !== 'false',
    maxAgeDays: parseInt(process.env.PASSWORD_MAX_AGE_DAYS || '90', 10),
    historySize: parseInt(process.env.PASSWORD_HISTORY_SIZE || '5', 10),
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secure-jwt-secret-min-32-chars-long',
    algorithm: process.env.JWT_ALGORITHM || 'HS256',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    issuer: process.env.JWT_ISSUER || 'mcp-server',
    audience: process.env.JWT_AUDIENCE || 'mcp-client',
  },
  apiSecurity: {
    enableRequestValidation: process.env.API_ENABLE_REQUEST_VALIDATION !== 'false',
    enableResponseValidation: process.env.API_ENABLE_RESPONSE_VALIDATION !== 'false',
    maxRequestSize: process.env.API_MAX_REQUEST_SIZE || '1mb',
    enableQueryValidation: process.env.API_ENABLE_QUERY_VALIDATION !== 'false',
    enableParamValidation: process.env.API_ENABLE_PARAM_VALIDATION !== 'false',
  },
  logging: {
    enableSecurityLogging: process.env.ENABLE_SECURITY_LOGGING !== 'false',
    logSensitiveData: process.env.LOG_SENSITIVE_DATA === 'true',
    logFailedLoginAttempts: process.env.LOG_FAILED_LOGIN_ATTEMPTS !== 'false',
    logSuccessfulLogins: process.env.LOG_SUCCESSFUL_LOGINS === 'true',
  },
});

// Parse and validate the configuration
const parseConfig = (): SecurityConfig => {
  try {
    const config = parseEnv();
    return SecurityConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorDetails = error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code
      }));
      console.error('❌ Invalid security configuration:', JSON.stringify(errorDetails, null, 2));
      throw new Error('Invalid security configuration. Please check your environment variables.');
    }
    throw error;
  }
};

// Export the validated configuration
const securityConfig = parseConfig();
export default securityConfig;
