/**
 * Global e2e test setup.
 * Loads env, silences noisy logs during tests, and ensures long-lived
 * resources are cleaned up between suites.
 */
import * as path from 'path';
import * as dotenv from 'dotenv';

// Prefer .env.test, fall back to .env (so CI can point at ephemeral DB)
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-e2e';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

// Keep Jest output readable.
jest.setTimeout(30_000);
