import { MIN_BUY_VALUE_USD } from '../config/constants';

/**
 * Determine if a buy transaction should trigger a notification
 * Filter out small test trades to avoid noise
 */
export function shouldNotifyBuy(transactionValueUsd: number): boolean {
    return transactionValueUsd >= MIN_BUY_VALUE_USD;
}

/**
 * Determine if a sell transaction should trigger a notification
 * ALWAYS return true - we want to track ALL whale sell behavior
 */
export function shouldNotifySell(): boolean {
    return true;
}

/**
 * Format hold duration for display
 */
export function formatHoldDuration(seconds: number): string {
    if (seconds < 60) {
        return `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
        return `${minutes}m`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours < 24) {
        return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }

    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;

    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

/**
 * Format USD amount for display
 */
export function formatUSD(amount: number): string {
    if (amount >= 1000000) {
        return `$${(amount / 1000000).toFixed(2)}M`;
    }
    if (amount >= 1000) {
        return `$${(amount / 1000).toFixed(2)}K`;
    }
    return `$${amount.toFixed(2)}`;
}

/**
 * Format percentage for display
 */
export function formatPercent(percent: number): string {
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${percent.toFixed(2)}%`;
}
