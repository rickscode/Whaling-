import * as dotenv from 'dotenv';

dotenv.config();

// Monitoring configuration
export const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '10000', 10);
export const MIN_BUY_VALUE_USD = parseFloat(process.env.MIN_BUY_VALUE_USD || '1000');
export const MAX_TOKEN_AGE_MINUTES = parseInt(process.env.MAX_TOKEN_AGE_MINUTES || '60', 10);

// Solana constants
export const WRAPPED_SOL = 'So11111111111111111111111111111111111111112';
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

// Helius configuration
export const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '';
export const HELIUS_API_URL = 'https://api.helius.xyz/v0';

// Telegram configuration
export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
export const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

// Logging configuration
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
export const NODE_ENV = process.env.NODE_ENV || 'development';

// Validate required environment variables
export function validateEnvVariables(): void {
    const required = [
        'HELIUS_API_KEY',
        'SUPABASE_URL',
        'SUPABASE_ANON_KEY',
        'TELEGRAM_BOT_TOKEN',
        'TELEGRAM_CHAT_ID'
    ];

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
}
