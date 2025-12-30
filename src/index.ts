import * as fs from 'fs';
import * as path from 'path';
import { validateEnvVariables, POLL_INTERVAL_MS } from './config/constants';
import { WalletsConfig } from './types';
import { testConnection as testSupabaseConnection } from './database/supabase';
import { heliusService } from './services/helius';
import { telegramService } from './services/telegram';
import { parseSwapTransaction } from './services/parser';
import { shouldNotifyBuy, shouldNotifySell } from './utils/filters';
import {
    isSignatureProcessed,
    markSignatureProcessed,
    recordBuyTransaction,
    recordSellTransaction,
    getOpenPosition
} from './database/queries';
import { logger } from './utils/logger';

// Track last processed signature for each wallet to avoid re-processing
const lastProcessedSignatures = new Map<string, string>();

async function loadWallets(): Promise<WalletsConfig> {
    const walletsPath = path.join(__dirname, 'config', 'wallets.json');
    const walletsData = fs.readFileSync(walletsPath, 'utf-8');
    return JSON.parse(walletsData) as WalletsConfig;
}

async function processWallet(walletAddress: string, walletLabel?: string): Promise<void> {
    try {
        logger.debug(`Fetching transactions for wallet: ${walletAddress}`);

        // Fetch recent transactions
        const transactions = await heliusService.getWalletTransactions(walletAddress, 10);

        // Get the last processed signature for this wallet
        const lastProcessed = lastProcessedSignatures.get(walletAddress);

        // Process transactions in chronological order (oldest first)
        const reversedTxs = [...transactions].reverse();

        for (const tx of reversedTxs) {
            // Stop when we reach the last processed signature
            if (lastProcessed && tx.signature === lastProcessed) {
                break;
            }

            // Check if already processed in database
            const processed = await isSignatureProcessed(tx.signature);
            if (processed) {
                logger.debug(`Skipping already processed signature: ${tx.signature}`);
                continue;
            }

            // Parse the transaction
            const parsed = await parseSwapTransaction(tx, walletAddress);
            if (!parsed) {
                // Not a swap or couldn't parse - mark as processed and continue
                await markSignatureProcessed(tx.signature, walletAddress);
                continue;
            }

            logger.info(`Detected ${parsed.type.toUpperCase()}: ${parsed.tokenSymbol} by ${walletLabel || walletAddress.slice(0, 8)}`);

            if (parsed.type === 'buy') {
                // Record buy in database
                await recordBuyTransaction({
                    walletAddress,
                    tokenMint: parsed.tokenMint,
                    tokenSymbol: parsed.tokenSymbol,
                    tokenName: parsed.tokenName,
                    signature: parsed.signature,
                    timestamp: parsed.timestamp,
                    priceUsd: parsed.priceUsd,
                    amount: parsed.amount,
                    valueUsd: parsed.valueUsd
                });

                // Check if we should notify
                if (shouldNotifyBuy(parsed.valueUsd)) {
                    logger.info(`Sending buy notification: ${parsed.tokenSymbol} - ${parsed.valueUsd.toFixed(2)} USD`);
                    await telegramService.sendBuyNotification({
                        walletAddress,
                        walletLabel,
                        tokenSymbol: parsed.tokenSymbol,
                        tokenName: parsed.tokenName,
                        amount: parsed.amount,
                        priceUsd: parsed.priceUsd,
                        valueUsd: parsed.valueUsd,
                        signature: parsed.signature
                    });
                } else {
                    logger.info(`Buy below threshold, not notifying: ${parsed.valueUsd.toFixed(2)} USD`);
                }
            } else {
                // SELL transaction
                // Get the open position
                const position = await getOpenPosition(walletAddress, parsed.tokenMint);

                if (!position) {
                    logger.warn(`Sell without open position: ${walletAddress} ${parsed.tokenMint}`);
                    await markSignatureProcessed(tx.signature, walletAddress);
                    continue;
                }

                // Record sell
                await recordSellTransaction({
                    walletAddress,
                    tokenMint: parsed.tokenMint,
                    signature: parsed.signature,
                    timestamp: parsed.timestamp,
                    priceUsd: parsed.priceUsd,
                    amount: parsed.amount,
                    valueUsd: parsed.valueUsd
                });

                // Get updated position to calculate P&L
                const buyTimestamp = new Date(position.buy_timestamp).getTime() / 1000;
                const holdDurationSeconds = parsed.timestamp - buyTimestamp;
                const profitLossUsd = parsed.valueUsd - position.buy_value_usd;
                const profitLossPercent = ((parsed.priceUsd - position.buy_price_usd) / position.buy_price_usd) * 100;

                // Always notify on sells (no filtering)
                if (shouldNotifySell()) {
                    logger.info(`Sending sell notification: ${parsed.tokenSymbol} - P&L: ${profitLossPercent.toFixed(2)}%`);
                    await telegramService.sendSellNotification({
                        walletAddress,
                        walletLabel,
                        tokenSymbol: parsed.tokenSymbol,
                        tokenName: parsed.tokenName,
                        amount: parsed.amount,
                        buyPriceUsd: position.buy_price_usd,
                        sellPriceUsd: parsed.priceUsd,
                        buyValueUsd: position.buy_value_usd,
                        sellValueUsd: parsed.valueUsd,
                        profitLossUsd,
                        profitLossPercent,
                        holdDurationSeconds,
                        signature: parsed.signature
                    });
                }
            }

            // Mark as processed
            await markSignatureProcessed(tx.signature, walletAddress);
        }

        // Update last processed signature for this wallet
        if (transactions.length > 0) {
            lastProcessedSignatures.set(walletAddress, transactions[0].signature);
        }
    } catch (error) {
        logger.error(`Error processing wallet ${walletAddress}:`, error);
        // Don't throw - continue with next wallet
    }
}

async function monitoringLoop(wallets: WalletsConfig): Promise<void> {
    while (true) {
        logger.debug('Starting monitoring cycle...');

        for (const wallet of wallets.wallets) {
            await processWallet(wallet.address, wallet.label);

            // Small delay between wallets to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        logger.debug(`Monitoring cycle complete. Waiting ${POLL_INTERVAL_MS}ms...`);
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }
}

async function main(): Promise<void> {
    try {
        logger.info('Starting Solana Whale Tracker...');

        // Validate environment variables
        validateEnvVariables();

        // Test connections
        logger.info('Testing Supabase connection...');
        const supabaseOk = await testSupabaseConnection();
        if (!supabaseOk) {
            throw new Error('Supabase connection failed');
        }

        logger.info('Testing Helius API connection...');
        const heliusOk = await heliusService.testConnection();
        if (!heliusOk) {
            throw new Error('Helius API connection failed');
        }

        logger.info('Testing Telegram bot connection...');
        const telegramOk = await telegramService.testConnection();
        if (!telegramOk) {
            throw new Error('Telegram bot connection failed');
        }

        // Load wallets
        const wallets = await loadWallets();
        logger.info(`Loaded ${wallets.wallets.length} wallet(s) to monitor`);

        for (const wallet of wallets.wallets) {
            logger.info(`  - ${wallet.label || wallet.address}`);
        }

        // Start monitoring
        logger.info('Starting monitoring loop...');
        await monitoringLoop(wallets);
    } catch (error) {
        logger.error('Fatal error:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    process.exit(0);
});

// Start the application
main();
