// Database types
export interface Position {
    id: string;
    wallet_address: string;
    token_mint: string;
    token_symbol: string | null;
    token_name: string | null;
    buy_signature: string;
    buy_timestamp: string;
    buy_price_usd: number;
    buy_amount: number;
    buy_value_usd: number;
    sell_signature: string | null;
    sell_timestamp: string | null;
    sell_price_usd: number | null;
    sell_amount: number | null;
    sell_value_usd: number | null;
    hold_duration_seconds: number | null;
    profit_loss_usd: number | null;
    profit_loss_percent: number | null;
    is_open: boolean;
    created_at: string;
    updated_at: string;
}

// Helius API types
export interface HeliusTokenTransfer {
    fromUserAccount: string;
    toUserAccount: string;
    mint: string;
    tokenAmount: number;
    tokenStandard: string;
}

export interface HeliusNativeTransfer {
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
}

export interface HeliusTransaction {
    description: string;
    type: string;
    source: string;
    fee: number;
    feePayer: string;
    signature: string;
    slot: number;
    timestamp: number;
    tokenTransfers: HeliusTokenTransfer[];
    nativeTransfers: HeliusNativeTransfer[];
    accountData: any[];
    transactionError: any | null;
    instructions: any[];
    events: any;
}

// Parsed transaction types
export interface ParsedTokenTransfer {
    type: 'buy' | 'sell';
    tokenMint: string;
    tokenSymbol: string;
    tokenName: string;
    amount: number;
    priceUsd: number;
    valueUsd: number;
    signature: string;
    timestamp: number;
}

// Database operation types
export interface BuyTransactionData {
    walletAddress: string;
    tokenMint: string;
    tokenSymbol: string;
    tokenName: string;
    signature: string;
    timestamp: number;
    priceUsd: number;
    amount: number;
    valueUsd: number;
}

export interface SellTransactionData {
    walletAddress: string;
    tokenMint: string;
    signature: string;
    timestamp: number;
    priceUsd: number;
    amount: number;
    valueUsd: number;
}

// Telegram notification types
export interface BuyNotificationData {
    walletAddress: string;
    walletLabel?: string;
    tokenSymbol: string;
    tokenName: string;
    amount: number;
    priceUsd: number;
    valueUsd: number;
    signature: string;
}

export interface SellNotificationData {
    walletAddress: string;
    walletLabel?: string;
    tokenSymbol: string;
    tokenName: string;
    amount: number;
    buyPriceUsd: number;
    sellPriceUsd: number;
    buyValueUsd: number;
    sellValueUsd: number;
    profitLossUsd: number;
    profitLossPercent: number;
    holdDurationSeconds: number;
    signature: string;
}

// Configuration types
export interface WalletConfig {
    address: string;
    label?: string;
}

export interface WalletsConfig {
    wallets: WalletConfig[];
}
