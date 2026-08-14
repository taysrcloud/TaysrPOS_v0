import dotenv from 'dotenv';
dotenv.config();

export const NODE_ENV = process.env.NODE_ENV || 'development';
export const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4400;

const rawJwtSecret = process.env.JWT_SECRET;
if (NODE_ENV === 'production') {
  if (!rawJwtSecret || rawJwtSecret.length < 32) {
    throw new Error(
      'FATAL: JWT_SECRET environment variable must be set to a secure string of at least 32 characters in production.'
    );
  }
}

export const JWT_SECRET = rawJwtSecret || 'taysr-pos-dev-secret-key-minimum-32-chars-long';

export const CORS_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim())
  : undefined;
