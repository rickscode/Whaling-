# Solana Whale Tracker Telegram Bot

## Overview
A Telegram bot that monitors buy/sell transactions of specific Solana wallet addresses and notifies you with smart filtering for quick flips vs. legitimate holds.

## Features
- ✅ Real-time monitoring of specified Solana wallet addresses
- ✅ Telegram notifications for buy/sell events
- ✅ Filter out quick flips (< 5 minutes between buy and sell)
- ✅ Recommendation system based on hold duration (>24 hours = recommended)
- ✅ Track position entry and exit timestamps
- ✅ Distinguish between quick flips and legitimate trades

## Architecture

```
┌─────────────────┐
│  Solana RPC/    │
│  Helius API     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│  Transaction    │◄─────┤   Database   │
│  Monitor        │      │   (SQLite/   │
│  Service        │      │   PostgreSQL)│
└────────┬────────┘      └──────────────┘
         │
         ▼
┌─────────────────┐
│  Filter &       │
│  Analysis       │
│  Engine         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Telegram Bot   │
│  Notifications  │
└─────────────────┘
```

## Tech Stack

- **Language**: Node.js (TypeScript) or Python
- **Blockchain**: 
  - Solana Web3.js
  - Helius API (recommended for reliable transaction parsing)
- **Database**: SQLite (simple) or PostgreSQL (production)
- **Telegram**: node-telegram-bot-api or python-telegram-bot
- **Hosting**: VPS (DigitalOcean, AWS, Railway, etc.)

## Prerequisites

1. **Solana RPC Endpoint**
   - Free: QuickNode, Alchemy, or public endpoints
   - Recommended: Helius (better transaction parsing)
   
2. **Telegram Bot Token**
   - Message [@BotFather](https://t.me/botfather) on Telegram
   - Create new bot: `/newbot`
   - Save your bot token

3. **Wallet Addresses to Track**
   - List of whale wallet addresses you want to monitor

## Implementation Guide

### 1. Project Setup (Node.js/TypeScript)

```bash
mkdir solana-whale-tracker
cd solana-whale-tracker
npm init -y
npm install @solana/web3.js node-telegram-bot-api sqlite3 dotenv
npm install -D typescript @types/node @types/node-telegram-bot-api
npx tsc --init
```

### 2. Environment Configuration

Create `.env` file:

```env
# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here

# Solana
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
# Or Helius
HELIUS_API_KEY=your_helius_api_key

# Monitoring
POLL_INTERVAL=10000
MIN_HOLD_DURATION_HOURS=24
QUICK_FLIP_THRESHOLD_MINUTES=5
```

### 3. Database Schema

```sql
-- positions.sql
CREATE TABLE IF NOT EXISTS positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_address TEXT NOT NULL,
    token_mint TEXT NOT NULL,
    token_symbol TEXT,
    buy_signature TEXT UNIQUE NOT NULL,
    buy_timestamp INTEGER NOT NULL,
    buy_price REAL,
    buy_amount REAL,
    sell_signature TEXT,
    sell_timestamp INTEGER,
    sell_price REAL,
    sell_amount REAL,
    hold_duration_minutes INTEGER,
    is_quick_flip BOOLEAN DEFAULT 0,
    is_recommended BOOLEAN DEFAULT 0,
    notified BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tracked_wallets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_address TEXT UNIQUE NOT NULL,
    label TEXT,
    active BOOLEAN DEFAULT 1,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_positions_wallet ON positions(wallet_address);
CREATE INDEX idx_positions_token ON positions(token_mint);
CREATE INDEX idx_positions_buy_timestamp ON positions(buy_timestamp);
```

### 4. Core Implementation

#### Database Handler (`database.ts`)

```typescript
import sqlite3 from 'sqlite3';
import { Database } from 'sqlite3';

export class DatabaseHandler {
    private db: Database;

    constructor(dbPath: string = './whale_tracker.db') {
        this.db = new sqlite3.Database(dbPath);
        this.initDatabase();
    }

    private initDatabase(): void {
        // Read and execute the SQL schema from positions.sql
        // Implementation here...
    }

    async recordBuy(data: {
        walletAddress: string;
        tokenMint: string;
        tokenSymbol: string;
        signature: string;
        timestamp: number;
        price: number;
        amount: number;
    }): Promise<void> {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO positions 
                (wallet_address, token_mint, token_symbol, buy_signature, 
                 buy_timestamp, buy_price, buy_amount)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            
            this.db.run(sql, [
                data.walletAddress,
                data.tokenMint,
                data.tokenSymbol,
                data.signature,
                data.timestamp,
                data.price,
                data.amount
            ], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async recordSell(data: {
        walletAddress: string;
        tokenMint: string;
        signature: string;
        timestamp: number;
        price: number;
        amount: number;
    }): Promise<void> {
        return new Promise((resolve, reject) => {
            const sql = `
                UPDATE positions 
                SET sell_signature = ?,
                    sell_timestamp = ?,
                    sell_price = ?,
                    sell_amount = ?,
                    hold_duration_minutes = CAST((? - buy_timestamp) / 60.0 AS INTEGER),
                    is_quick_flip = CASE 
                        WHEN (? - buy_timestamp) < ? THEN 1 
                        ELSE 0 
                    END,
                    is_recommended = CASE 
                        WHEN (? - buy_timestamp) >= ? THEN 1 
                        ELSE 0 
                    END
                WHERE wallet_address = ? 
                  AND token_mint = ?
                  AND sell_signature IS NULL
                ORDER BY buy_timestamp DESC
                LIMIT 1
            `;
            
            const quickFlipThreshold = 5 * 60; // 5 minutes in seconds
            const recommendedThreshold = 24 * 60 * 60; // 24 hours in seconds
            
            this.db.run(sql, [
                data.signature,
                data.timestamp,
                data.price,
                data.amount,
                data.timestamp, // for hold_duration calculation
                data.timestamp, // for is_quick_flip
                quickFlipThreshold,
                data.timestamp, // for is_recommended
                recommendedThreshold,
                data.walletAddress,
                data.tokenMint
            ], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async getOpenPosition(walletAddress: string, tokenMint: string): Promise<any> {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT * FROM positions 
                WHERE wallet_address = ? 
                  AND token_mint = ?
                  AND sell_signature IS NULL
                ORDER BY buy_timestamp DESC
                LIMIT 1
            `;
            
            this.db.get(sql, [walletAddress, tokenMint], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    async addTrackedWallet(address: string, label?: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const sql = `INSERT OR IGNORE INTO tracked_wallets (wallet_address, label) VALUES (?, ?)`;
            this.db.run(sql, [address, label || ''], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async getTrackedWallets(): Promise<string[]> {
        return new Promise((resolve, reject) => {
            const sql = `SELECT wallet_address FROM tracked_wallets WHERE active = 1`;
            this.db.all(sql, [], (err, rows: any[]) => {
                if (err) reject(err);
                else resolve(rows.map(r => r.wallet_address));
            });
        });
    }
}
```

#### Transaction Monitor (`monitor.ts`)

```typescript
import { Connection, PublicKey, ParsedTransactionWithMeta } from '@solana/web3.js';
import { DatabaseHandler } from './database';
import { TelegramNotifier } from './telegram';

interface TokenTransfer {
    type: 'buy' | 'sell';
    tokenMint: string;
    tokenSymbol: string;
    amount: number;
    price: number;
    signature: string;
    timestamp: number;
}

export class TransactionMonitor {
    private connection: Connection;
    private db: DatabaseHandler;
    private telegram: TelegramNotifier;
    private lastProcessedSignatures: Map<string, string> = new Map();

    constructor(
        rpcUrl: string,
        db: DatabaseHandler,
        telegram: TelegramNotifier
    ) {
        this.connection = new Connection(rpcUrl, 'confirmed');
        this.db = db;
        this.telegram = telegram;
    }

    async monitorWallet(walletAddress: string): Promise<void> {
        try {
            const pubkey = new PublicKey(walletAddress);
            const signatures = await this.connection.getSignaturesForAddress(pubkey, {
                limit: 10
            });

            const lastProcessed = this.lastProcessedSignatures.get(walletAddress);

            for (const sigInfo of signatures) {
                if (lastProcessed && sigInfo.signature === lastProcessed) {
                    break;
                }

                await this.processTransaction(walletAddress, sigInfo.signature);
            }

            if (signatures.length > 0) {
                this.lastProcessedSignatures.set(walletAddress, signatures[0].signature);
            }
        } catch (error) {
            console.error(`Error monitoring wallet ${walletAddress}:`, error);
        }
    }

    private async processTransaction(walletAddress: string, signature: string): Promise<void> {
        try {
            const tx = await this.connection.getParsedTransaction(signature, {
                maxSupportedTransactionVersion: 0
            });

            if (!tx || !tx.meta || tx.meta.err) {
                return;
            }

            const transfer = this.parseTokenTransfer(tx, walletAddress);
            if (!transfer) {
                return;
            }

            if (transfer.type === 'buy') {
                await this.handleBuy(walletAddress, transfer);
            } else {
                await this.handleSell(walletAddress, transfer);
            }
        } catch (error) {
            console.error(`Error processing transaction ${signature}:`, error);
        }
    }

    private parseTokenTransfer(
        tx: ParsedTransactionWithMeta,
        walletAddress: string
    ): TokenTransfer | null {
        // This is simplified - you'll need to parse the transaction properly
        // Look for token transfers in tx.meta.preTokenBalances and postTokenBalances
        // Determine if it's a buy or sell based on balance changes
        
        // For Solana DEX transactions (Raydium, Orca, etc.), you need to:
        // 1. Check if wallet's token balance increased (buy) or decreased (sell)
        // 2. Extract token mint address
        // 3. Calculate amount and price
        
        // This requires parsing swap instructions specific to each DEX
        // Consider using Helius Parsed Transactions API for easier parsing
        
        return null; // Implement based on your needs
    }

    private async handleBuy(walletAddress: string, transfer: TokenTransfer): Promise<void> {
        await this.db.recordBuy({
            walletAddress,
            tokenMint: transfer.tokenMint,
            tokenSymbol: transfer.tokenSymbol,
            signature: transfer.signature,
            timestamp: transfer.timestamp,
            price: transfer.price,
            amount: transfer.amount
        });

        await this.telegram.sendBuyNotification({
            walletAddress,
            tokenSymbol: transfer.tokenSymbol,
            amount: transfer.amount,
            price: transfer.price,
            signature: transfer.signature
        });
    }

    private async handleSell(walletAddress: string, transfer: TokenTransfer): Promise<void> {
        const position = await this.db.getOpenPosition(walletAddress, transfer.tokenMint);
        
        if (!position) {
            console.log('No open position found for sell');
            return;
        }

        await this.db.recordSell({
            walletAddress,
            tokenMint: transfer.tokenMint,
            signature: transfer.signature,
            timestamp: transfer.timestamp,
            price: transfer.price,
            amount: transfer.amount
        });

        const holdDurationSeconds = transfer.timestamp - position.buy_timestamp;
        const holdDurationMinutes = Math.floor(holdDurationSeconds / 60);
        const holdDurationHours = Math.floor(holdDurationSeconds / 3600);
        
        const isQuickFlip = holdDurationSeconds < (5 * 60); // < 5 minutes
        const isRecommended = holdDurationSeconds >= (24 * 60 * 60); // >= 24 hours

        // Filter: Don't notify on quick flips
        if (isQuickFlip) {
            console.log(`Filtered out quick flip: ${transfer.tokenSymbol} (${holdDurationMinutes}m)`);
            return;
        }

        await this.telegram.sendSellNotification({
            walletAddress,
            tokenSymbol: transfer.tokenSymbol,
            buyPrice: position.buy_price,
            sellPrice: transfer.price,
            amount: transfer.amount,
            holdDuration: holdDurationHours,
            isRecommended,
            profitPercent: ((transfer.price - position.buy_price) / position.buy_price) * 100,
            signature: transfer.signature
        });
    }
}
```

#### Telegram Notifier (`telegram.ts`)

```typescript
import TelegramBot from 'node-telegram-bot-api';

export class TelegramNotifier {
    private bot: TelegramBot;
    private chatId: string;

    constructor(token: string, chatId: string) {
        this.bot = new TelegramBot(token, { polling: false });
        this.chatId = chatId;
    }

    async sendBuyNotification(data: {
        walletAddress: string;
        tokenSymbol: string;
        amount: number;
        price: number;
        signature: string;
    }): Promise<void> {
        const message = `
🟢 <b>BUY ALERT</b>

Wallet: <code>${this.truncateAddress(data.walletAddress)}</code>
Token: <b>${data.tokenSymbol}</b>
Amount: ${data.amount.toFixed(4)}
Price: $${data.price.toFixed(6)}
Value: $${(data.amount * data.price).toFixed(2)}

<a href="https://solscan.io/tx/${data.signature}">View Transaction</a>
        `.trim();

        await this.bot.sendMessage(this.chatId, message, { parse_mode: 'HTML' });
    }

    async sendSellNotification(data: {
        walletAddress: string;
        tokenSymbol: string;
        buyPrice: number;
        sellPrice: number;
        amount: number;
        holdDuration: number;
        isRecommended: boolean;
        profitPercent: number;
        signature: string;
    }): Promise<void> {
        const emoji = data.profitPercent >= 0 ? '🟢' : '🔴';
        const recommendation = data.isRecommended 
            ? '⭐ <b>RECOMMENDED</b> (Held >24h)' 
            : '⚠️ Sold before 24h - NOT recommended';

        const message = `
${emoji} <b>SELL ALERT</b>

Wallet: <code>${this.truncateAddress(data.walletAddress)}</code>
Token: <b>${data.tokenSymbol}</b>
Amount: ${data.amount.toFixed(4)}

Buy Price: $${data.buyPrice.toFixed(6)}
Sell Price: $${data.sellPrice.toFixed(6)}
P&L: ${data.profitPercent >= 0 ? '+' : ''}${data.profitPercent.toFixed(2)}%

Hold Duration: ${data.holdDuration}h
${recommendation}

<a href="https://solscan.io/tx/${data.signature}">View Transaction</a>
        `.trim();

        await this.bot.sendMessage(this.chatId, message, { parse_mode: 'HTML' });
    }

    private truncateAddress(address: string): string {
        return `${address.slice(0, 4)}...${address.slice(-4)}`;
    }
}
```

#### Main Application (`index.ts`)

```typescript
import * as dotenv from 'dotenv';
import { DatabaseHandler } from './database';
import { TransactionMonitor } from './monitor';
import { TelegramNotifier } from './telegram';

dotenv.config();

// Your tracked wallet addresses
const TRACKED_WALLETS = [
    '6FNy8RFVYoWUZU4TcsjwYp9dSCxe9GUxELg5qy4oekbS', // Example whale wallet
    // Add more addresses here
];

async function main() {
    console.log('🚀 Starting Solana Whale Tracker...');

    // Initialize components
    const db = new DatabaseHandler();
    const telegram = new TelegramNotifier(
        process.env.TELEGRAM_BOT_TOKEN!,
        process.env.TELEGRAM_CHAT_ID!
    );
    const monitor = new TransactionMonitor(
        process.env.SOLANA_RPC_URL!,
        db,
        telegram
    );

    // Add tracked wallets to database
    for (const wallet of TRACKED_WALLETS) {
        await db.addTrackedWallet(wallet);
    }

    console.log(`📊 Monitoring ${TRACKED_WALLETS.length} wallets`);

    // Main monitoring loop
    setInterval(async () => {
        const wallets = await db.getTrackedWallets();
        
        for (const wallet of wallets) {
            await monitor.monitorWallet(wallet);
            // Add small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }, parseInt(process.env.POLL_INTERVAL || '10000'));

    console.log('✅ Tracker is running!');
}

main().catch(console.error);
```

### 5. Advanced: Using Helius API

For better transaction parsing, use Helius Enhanced Transactions:

```typescript
// helius-monitor.ts
import axios from 'axios';

interface HeliusTransaction {
    type: string;
    source: string;
    tokenTransfers: Array<{
        mint: string;
        tokenAmount: number;
        fromUserAccount: string;
        toUserAccount: string;
    }>;
    nativeTransfers: Array<any>;
    signature: string;
    timestamp: number;
}

export class HeliusMonitor {
    private apiKey: string;
    private baseUrl = 'https://api.helius.xyz/v0';

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    async getTransactions(walletAddress: string): Promise<HeliusTransaction[]> {
        const response = await axios.get(
            `${this.baseUrl}/addresses/${walletAddress}/transactions`,
            {
                params: {
                    'api-key': this.apiKey,
                    limit: 10
                }
            }
        );
        return response.data;
    }

    parseSwapTransaction(tx: HeliusTransaction, walletAddress: string): TokenTransfer | null {
        if (tx.type !== 'SWAP') return null;

        const tokenTransfers = tx.tokenTransfers;
        let isBuy = false;
        let tokenMint = '';
        let amount = 0;

        // Determine if it's a buy or sell based on token flow
        for (const transfer of tokenTransfers) {
            if (transfer.toUserAccount === walletAddress && transfer.mint !== 'So11111111111111111111111111111111111111112') {
                // Receiving non-SOL token = BUY
                isBuy = true;
                tokenMint = transfer.mint;
                amount = transfer.tokenAmount;
            } else if (transfer.fromUserAccount === walletAddress && transfer.mint !== 'So11111111111111111111111111111111111111112') {
                // Sending non-SOL token = SELL
                isBuy = false;
                tokenMint = transfer.mint;
                amount = transfer.tokenAmount;
            }
        }

        return {
            type: isBuy ? 'buy' : 'sell',
            tokenMint,
            tokenSymbol: '', // Fetch from metadata
            amount,
            price: 0, // Calculate from native transfers
            signature: tx.signature,
            timestamp: tx.timestamp
        };
    }
}
```

## Deployment

### Option 1: Local/VPS

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run with PM2 (process manager)
npm install -g pm2
pm2 start dist/index.js --name whale-tracker
pm2 save
pm2 startup
```

### Option 2: Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .
RUN npm run build

CMD ["node", "dist/index.js"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  whale-tracker:
    build: .
    restart: unless-stopped
    env_file: .env
    volumes:
      - ./data:/app/data
```

## Configuration Tips

### Finding Whale Wallets

1. **DexScreener**: Look at top holders of trending tokens
2. **Solscan**: Check top accounts by SOL balance
3. **Bubblemaps**: Visualize token holder networks
4. **Twitter/Discord**: Follow known whale trackers

### Optimizing Performance

1. **Use Helius**: Better parsing, less rate limiting
2. **Implement caching**: Cache token metadata
3. **Batch operations**: Process multiple wallets in parallel
4. **Database indexing**: Index frequently queried columns
5. **Websocket subscriptions**: For real-time updates instead of polling

### Filter Refinements

```typescript
// Additional filters you might want:
- Minimum transaction value (ignore small trades)
- Token age (filter newly launched scam tokens)
- Liquidity requirements
- Multiple wallet confirmation (same token bought by X whales)
- Smart money scoring (historical performance of wallet)
```

## Monitoring & Maintenance

```bash
# Check bot status
pm2 status

# View logs
pm2 logs whale-tracker

# Monitor database size
du -h whale_tracker.db

# Backup database
cp whale_tracker.db whale_tracker.backup.db
```

## Future Enhancements

- [ ] Web dashboard for viewing tracked positions
- [ ] Portfolio analytics
- [ ] Automated token research (market cap, liquidity, etc.)
- [ ] Multiple Telegram channels/groups support
- [ ] Pattern recognition (whale accumulation phases)
- [ ] Integration with trading bots
- [ ] Multi-chain support (Ethereum, BSC, etc.)

## Troubleshooting

**Problem**: Rate limiting from RPC
- **Solution**: Use paid RPC provider or implement request queuing

**Problem**: Missing transactions
- **Solution**: Decrease poll interval or use websocket subscriptions

**Problem**: False quick flip detection
- **Solution**: Adjust threshold or check if same wallet bought/sold

**Problem**: Can't parse DEX transactions
- **Solution**: Use Helius or implement DEX-specific parsers

## Resources

- [Solana Web3.js Docs](https://solana-labs.github.io/solana-web3.js/)
- [Helius Developer Docs](https://docs.helius.dev/)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Solscan](https://solscan.io/)
- [DexScreener](https://dexscreener.com/)

## License

MIT - Use at your own risk. Not financial advice.

---

**Note**: This is a starting template. You'll need to implement the transaction parsing logic based on the specific DEXs you want to support (Raydium, Orca, Jupiter, etc.). Each DEX has different instruction formats that need to be parsed accordingly.