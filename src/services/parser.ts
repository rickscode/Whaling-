import { HeliusTransaction, ParsedTokenTransfer } from '../types';
import { WRAPPED_SOL, USDC_MINT, USDT_MINT, HELIUS_API_KEY, HELIUS_API_URL, MAX_TOKEN_AGE_MINUTES } from '../config/constants';
import axios from 'axios';

// Cache for token creation timestamps
const tokenAgeCache = new Map<string, number>();

/**
 * Parse a Helius transaction to extract swap information
 */
export async function parseSwapTransaction(
    tx: HeliusTransaction,
    walletAddress: string
): Promise<ParsedTokenTransfer | null> {
    // Only process SWAP transactions
    if (tx.type !== 'SWAP') {
        return null;
    }

    // Skip failed transactions
    if (tx.transactionError) {
        return null;
    }

    const { tokenTransfers, nativeTransfers } = tx;

    // Find the non-SOL token transfer involving this wallet
    let tokenTransfer = null;
    let isBuy = false;

    for (const transfer of tokenTransfers) {
        // Skip wrapped SOL transfers
        if (transfer.mint === WRAPPED_SOL) {
            continue;
        }

        if (transfer.toUserAccount?.toLowerCase() === walletAddress.toLowerCase()) {
            // Receiving token = BUY
            isBuy = true;
            tokenTransfer = transfer;
            break;
        } else if (transfer.fromUserAccount?.toLowerCase() === walletAddress.toLowerCase()) {
            // Sending token = SELL
            isBuy = false;
            tokenTransfer = transfer;
            break;
        }
    }

    if (!tokenTransfer) {
        return null;
    }

    // Calculate USD value from the swap
    const usdValue = calculateUSDValue(tokenTransfers, nativeTransfers, walletAddress, isBuy);
    const price = usdValue / tokenTransfer.tokenAmount;

    // Check token age for BUY transactions only
    let tokenAgeMinutes = null;
    if (isBuy) {
        const tokenCreationTime = await getTokenCreationTime(tokenTransfer.mint);
        if (tokenCreationTime) {
            tokenAgeMinutes = Math.floor((tx.timestamp - tokenCreationTime) / 60);

            // Filter: Only notify for tokens less than MAX_TOKEN_AGE_MINUTES old
            if (tokenAgeMinutes > MAX_TOKEN_AGE_MINUTES) {
                console.log(`Filtering out buy: Token ${tokenTransfer.mint} is ${tokenAgeMinutes} minutes old (> ${MAX_TOKEN_AGE_MINUTES} min threshold)`);
                return null;
            }
        }
    }

    // Use mint address as identifier
    return {
        type: isBuy ? 'buy' : 'sell',
        tokenMint: tokenTransfer.mint,
        tokenSymbol: tokenTransfer.mint,
        tokenName: tokenTransfer.mint,
        amount: tokenTransfer.tokenAmount,
        priceUsd: price,
        valueUsd: usdValue,
        signature: tx.signature,
        timestamp: tx.timestamp
    };
}

/**
 * Calculate USD value of the swap from SOL or stablecoin transfers
 */
function calculateUSDValue(
    tokenTransfers: any[],
    nativeTransfers: any[],
    walletAddress: string,
    isBuy: boolean
): number {
    // First, try to find USDC or USDT transfers
    for (const transfer of tokenTransfers) {
        if (transfer.mint === USDC_MINT || transfer.mint === USDT_MINT) {
            // For buy: wallet sends stablecoin
            // For sell: wallet receives stablecoin
            if (isBuy && transfer.fromUserAccount?.toLowerCase() === walletAddress.toLowerCase()) {
                return transfer.tokenAmount;
            } else if (!isBuy && transfer.toUserAccount?.toLowerCase() === walletAddress.toLowerCase()) {
                return transfer.tokenAmount;
            }
        }
    }

    // If no stablecoin, calculate from SOL transfers
    // Note: This requires knowing SOL price, which we don't have directly
    // For MVP, we'll estimate or use wrapped SOL transfers
    for (const transfer of tokenTransfers) {
        if (transfer.mint === WRAPPED_SOL) {
            const solAmount = transfer.tokenAmount;
            // TODO: Fetch current SOL price from an oracle or price feed
            // For now, use a placeholder (you'll need to implement price fetching)
            const estimatedSolPrice = 100; // Placeholder - REPLACE WITH ACTUAL PRICE
            return solAmount * estimatedSolPrice;
        }
    }

    // Fallback to native SOL transfers
    for (const transfer of nativeTransfers) {
        if (isBuy && transfer.fromUserAccount?.toLowerCase() === walletAddress.toLowerCase()) {
            const solAmount = transfer.amount / 1e9; // Convert lamports to SOL
            const estimatedSolPrice = 100; // Placeholder - REPLACE WITH ACTUAL PRICE
            return solAmount * estimatedSolPrice;
        } else if (!isBuy && transfer.toUserAccount?.toLowerCase() === walletAddress.toLowerCase()) {
            const solAmount = transfer.amount / 1e9; // Convert lamports to SOL
            const estimatedSolPrice = 100; // Placeholder - REPLACE WITH ACTUAL PRICE
            return solAmount * estimatedSolPrice;
        }
    }

    return 0;
}

/**
 * Get token creation timestamp from Solana blockchain
 */
async function getTokenCreationTime(mint: string): Promise<number | null> {
    // Check cache first
    if (tokenAgeCache.has(mint)) {
        return tokenAgeCache.get(mint)!;
    }

    try {
        // Use Helius to get the token's first transaction (mint creation)
        const response = await axios.get(
            `${HELIUS_API_URL}/addresses/${mint}/transactions`,
            {
                params: {
                    'api-key': HELIUS_API_KEY,
                    limit: 1,
                    type: 'any'
                }
            }
        );

        if (response.data && response.data.length > 0) {
            // The last transaction is the creation (mint initialization)
            const creationTx = response.data[response.data.length - 1];
            const creationTime = creationTx.timestamp;

            // Cache the result
            tokenAgeCache.set(mint, creationTime);
            return creationTime;
        }
    } catch (error) {
        console.error(`Error fetching token creation time for ${mint}:`, error);
    }

    // If we can't determine age, allow it through (don't filter)
    return null;
}
