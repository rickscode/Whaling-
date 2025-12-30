-- Solana Whale Tracker Database Schema
-- Run this in your Supabase SQL Editor

-- Create positions table
CREATE TABLE IF NOT EXISTS positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Wallet and token info
    wallet_address TEXT NOT NULL,
    token_mint TEXT NOT NULL,
    token_symbol TEXT,
    token_name TEXT,

    -- Buy transaction data
    buy_signature TEXT UNIQUE NOT NULL,
    buy_timestamp TIMESTAMPTZ NOT NULL,
    buy_price_usd NUMERIC(20, 10),
    buy_amount NUMERIC(30, 10),
    buy_value_usd NUMERIC(20, 2),

    -- Sell transaction data
    sell_signature TEXT,
    sell_timestamp TIMESTAMPTZ,
    sell_price_usd NUMERIC(20, 10),
    sell_amount NUMERIC(30, 10),
    sell_value_usd NUMERIC(20, 2),

    -- Calculated fields
    hold_duration_seconds INTEGER,
    profit_loss_usd NUMERIC(20, 2),
    profit_loss_percent NUMERIC(10, 2),

    -- Status flag
    is_open BOOLEAN DEFAULT TRUE,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_positions_wallet ON positions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_positions_token ON positions(token_mint);
CREATE INDEX IF NOT EXISTS idx_positions_is_open ON positions(is_open);
CREATE INDEX IF NOT EXISTS idx_positions_buy_timestamp ON positions(buy_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_positions_wallet_token_open ON positions(wallet_address, token_mint, is_open);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_positions_updated_at ON positions;
CREATE TRIGGER update_positions_updated_at
    BEFORE UPDATE ON positions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create table for tracking processed transactions (prevent duplicates)
CREATE TABLE IF NOT EXISTS processed_signatures (
    signature TEXT PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for processed signatures
CREATE INDEX IF NOT EXISTS idx_processed_signatures_wallet ON processed_signatures(wallet_address);
CREATE INDEX IF NOT EXISTS idx_processed_signatures_timestamp ON processed_signatures(processed_at DESC);

-- Add comments for documentation
COMMENT ON TABLE positions IS 'Tracks whale wallet buy/sell positions with P&L calculations';
COMMENT ON TABLE processed_signatures IS 'Prevents duplicate processing of transactions';
COMMENT ON COLUMN positions.is_open IS 'TRUE if position has not been sold yet';
COMMENT ON COLUMN positions.hold_duration_seconds IS 'Time between buy and sell in seconds';
