import { supabase } from './supabase';
import { Position, BuyTransactionData, SellTransactionData } from '../types';

/**
 * Check if a transaction signature has already been processed
 */
export async function isSignatureProcessed(signature: string): Promise<boolean> {
    const { data, error } = await supabase
        .from('processed_signatures')
        .select('signature')
        .eq('signature', signature)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error checking signature:', error);
    }

    return !!data;
}

/**
 * Mark a transaction signature as processed
 */
export async function markSignatureProcessed(signature: string, walletAddress: string): Promise<void> {
    const { error } = await supabase
        .from('processed_signatures')
        .insert({
            signature,
            wallet_address: walletAddress
        });

    if (error) {
        console.error('Error marking signature as processed:', error);
        throw error;
    }
}

/**
 * Record a buy transaction (open a new position)
 */
export async function recordBuyTransaction(data: BuyTransactionData): Promise<void> {
    const { error } = await supabase
        .from('positions')
        .insert({
            wallet_address: data.walletAddress,
            token_mint: data.tokenMint,
            token_symbol: data.tokenSymbol,
            token_name: data.tokenName,
            buy_signature: data.signature,
            buy_timestamp: new Date(data.timestamp * 1000).toISOString(),
            buy_price_usd: data.priceUsd,
            buy_amount: data.amount,
            buy_value_usd: data.valueUsd,
            is_open: true
        });

    if (error) {
        console.error('Error recording buy transaction:', error);
        throw error;
    }
}

/**
 * Get an open position for a wallet and token
 */
export async function getOpenPosition(walletAddress: string, tokenMint: string): Promise<Position | null> {
    const { data, error } = await supabase
        .from('positions')
        .select('*')
        .eq('wallet_address', walletAddress)
        .eq('token_mint', tokenMint)
        .eq('is_open', true)
        .order('buy_timestamp', { ascending: false })
        .limit(1)
        .single();

    if (error) {
        if (error.code === 'PGRST116') { // No rows returned
            return null;
        }
        console.error('Error getting open position:', error);
        throw error;
    }

    return data as Position;
}

/**
 * Record a sell transaction (close a position)
 */
export async function recordSellTransaction(data: SellTransactionData): Promise<void> {
    // Get the open position first
    const position = await getOpenPosition(data.walletAddress, data.tokenMint);

    if (!position) {
        console.warn(`No open position found for sell: ${data.walletAddress} ${data.tokenMint}`);
        return;
    }

    // Calculate metrics
    const buyTimestamp = new Date(position.buy_timestamp).getTime();
    const sellTimestamp = data.timestamp * 1000;
    const holdDurationSeconds = Math.floor((sellTimestamp - buyTimestamp) / 1000);

    const profitLossUsd = data.valueUsd - position.buy_value_usd;
    const profitLossPercent = ((data.priceUsd - position.buy_price_usd) / position.buy_price_usd) * 100;

    // Update the position
    const { error } = await supabase
        .from('positions')
        .update({
            sell_signature: data.signature,
            sell_timestamp: new Date(sellTimestamp).toISOString(),
            sell_price_usd: data.priceUsd,
            sell_amount: data.amount,
            sell_value_usd: data.valueUsd,
            hold_duration_seconds: holdDurationSeconds,
            profit_loss_usd: profitLossUsd,
            profit_loss_percent: profitLossPercent,
            is_open: false
        })
        .eq('id', position.id);

    if (error) {
        console.error('Error recording sell transaction:', error);
        throw error;
    }
}
