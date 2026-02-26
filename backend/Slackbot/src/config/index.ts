export interface Config {
  slack: {
    botToken: string;
    signingSecret: string;
    appToken: string;
  };
  gemini: {
    apiKey: string;
    model: string;
  };
  database: {
    url: string;
  };
  chroma: {
    host: string;
    port: string;
  };
  security: {
    encryptionKey: string;
    phiEncryptionEnabled: boolean;
  };
  app: {
    nodeEnv: string;
    logLevel: string;
  };
}

export const config: Config = {
  slack: {
    botToken: process.env.SLACK_BOT_TOKEN || '',
    signingSecret: process.env.SLACK_SIGNING_SECRET || '',
    appToken: process.env.SLACK_APP_TOKEN || '',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
  },
  database: {
    url: process.env.DATABASE_URL || '',
  },
  chroma: {
    host: process.env.CHROMA_HOST || 'localhost',
    port: process.env.CHROMA_PORT || '8000',
  },
  security: {
    encryptionKey: process.env.ENCRYPTION_KEY || 'default-key-replace',
    phiEncryptionEnabled: process.env.PHI_ENCRYPTION_ENABLED === 'true',
  },
  app: {
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
  },
};

export function validateConfig(): void {
  const required = [
    'SLACK_BOT_TOKEN',
    'SLACK_SIGNING_SECRET',
    'SLACK_APP_TOKEN',
    'GEMINI_API_KEY',
    'DATABASE_URL',
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please check your .env file.'
    );
  }

  if (config.security.encryptionKey === 'default-key-replace') {
    console.warn(
      '⚠️  WARNING: Using default encryption key. ' +
      'Generate a secure key for production!'
    );
  }
}
