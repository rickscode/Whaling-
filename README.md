# Solana Whale Tracker

A Telegram bot that monitors Solana whale wallet transactions in real-time, tracking buy/sell activity to help you copy successful trades.

## Features

- Real-time monitoring of Solana whale wallets via Helius API
- Instant buy alerts for significant positions (>= $1000 by default)
- Complete sell tracking to analyze whale exit patterns
- PostgreSQL database (Supabase) for position tracking
- Profit/loss calculations with hold duration analysis
- Telegram notifications with Solscan links

## Prerequisites

Before you begin, ensure you have:

1. **Node.js** (v18 or higher)
2. **Helius API Key** - [Get one here](https://www.helius.dev/)
3. **Supabase Account** - [Sign up](https://supabase.com/)
4. **Telegram Bot Token** - Create via [@BotFather](https://t.me/botfather)
5. **Whale Wallet Addresses** - Addresses you want to track

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example env file and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env` with your actual values:

```env
# Helius API
HELIUS_API_KEY=your_helius_api_key_here

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Telegram
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=123456789

# Monitoring
POLL_INTERVAL_MS=10000
MIN_BUY_VALUE_USD=1000
```

### 3. Set Up Supabase Database

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy the contents of `src/database/schema.sql`
4. Run the SQL script in the Supabase SQL Editor

This will create the necessary tables and indexes.

### 4. Configure Wallets to Track

Edit `src/config/wallets.json` and add the whale wallet addresses you want to monitor:

```json
{
  "wallets": [
    {
      "address": "6FNy8RFVYoWUZU4TcsjwYp9dSCxe9GUxELg5qy4oekbS",
      "label": "Whale 1"
    },
    {
      "address": "ANOTHER_WALLET_ADDRESS",
      "label": "Whale 2"
    }
  ]
}
```

### 5. Get Your Telegram Chat ID

To find your Telegram Chat ID:

1. Start a conversation with your bot on Telegram
2. Send it any message
3. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. Look for `"chat":{"id":123456789}` in the response
5. Use that number as your `TELEGRAM_CHAT_ID`

## Running the Application

### Development Mode

```bash
npm run dev
```

This runs the bot with auto-reload on code changes.

### Production Build

```bash
npm run build
npm start
```

### Using PM2 (Recommended for Production)

Install PM2 globally:

```bash
npm install -g pm2
```

Start the tracker:

```bash
pm2 start dist/index.js --name whale-tracker
```

Monitor the process:

```bash
pm2 status
pm2 logs whale-tracker
pm2 monit
```

Auto-restart on server reboot:

```bash
pm2 startup
pm2 save
```

## How It Works

1. **Polling**: Every 10 seconds (configurable), the bot fetches recent transactions from each wallet
2. **Parsing**: Transactions are parsed to identify SWAP operations (buys and sells)
3. **Filtering**:
   - **Buys**: Only notifies if transaction value >= $1000 (configurable)
   - **Sells**: ALL sells are notified (no filtering)
4. **Database**: Positions are tracked in Supabase to match buys with sells
5. **Notifications**: Telegram alerts with transaction details and Solscan links

## Notification Types

### Buy Alert

```
BUY ALERT

Wallet: Whale 1
6FNy...ekbS

Token: BONK
Amount: 1,000,000
Price: $0.000025
Value: $25.00K

View Transaction →
```

### Sell Alert

```
SELL ALERT

Wallet: Whale 1
6FNy...ekbS

Token: BONK
Amount: 1,000,000

Buy Price: $0.000025
Sell Price: $0.000035

Buy Value: $25.00K
Sell Value: $35.00K

P&L: $10.00K (+40.00%)
Hold Time: 2d 5h

View Transaction →
```

## Configuration

### Adjusting Buy Alert Threshold

Edit `.env` and change:

```env
MIN_BUY_VALUE_USD=1000  # Change to your preferred minimum
```

### Changing Poll Interval

Edit `.env` and adjust:

```env
POLL_INTERVAL_MS=10000  # 10 seconds (10000ms)
```

**Note**: Lower values = faster alerts but more API calls. Helius free tier has limits.

## Important Notes

### SOL Price Estimation

The current implementation uses a **placeholder SOL price** for calculating USD values when transactions are in SOL (not USDC/USDT).

**TODO**: Implement actual SOL price fetching from an oracle or price feed API.

Find this in `src/services/parser.ts:72` and replace:

```typescript
const estimatedSolPrice = 100; // REPLACE WITH ACTUAL PRICE
```

### API Rate Limits

- **Helius Free Tier**: 100k requests/day
- **3 wallets @ 10s polling**: ~25k requests/day
- You're well within limits, but monitor if you add many wallets

### Database Cleanup

Processed signatures are stored indefinitely. To clean up old records:

```sql
-- Run this monthly in Supabase SQL Editor
DELETE FROM processed_signatures
WHERE processed_at < NOW() - INTERVAL '30 days';
```

## Troubleshooting

### "Missing required environment variables"

- Double-check your `.env` file has all required variables
- Make sure the file is named `.env` exactly (not `.env.txt`)

### "Supabase connection failed"

- Verify your `SUPABASE_URL` and `SUPABASE_ANON_KEY` are correct
- Ensure you ran the schema.sql script in Supabase
- Check that the tables exist in your Supabase project

### "No transactions detected"

- Verify the wallet addresses in `wallets.json` are correct
- Check if the whales are actually trading (view on Solscan)
- Ensure your Helius API key is valid

### "Rate limit exceeded"

- Increase `POLL_INTERVAL_MS` to reduce API calls
- Consider upgrading your Helius plan

## Future Enhancements

- [ ] Fetch real-time SOL price from oracle/API
- [ ] Add more filters (token age, liquidity, etc.)
- [ ] Telegram commands to add/remove wallets
- [ ] Web dashboard for viewing positions
- [ ] Pattern recognition for whale accumulation
- [ ] Multi-chain support (Ethereum, BSC, etc.)

## Security

- Never commit your `.env` file (it's in `.gitignore`)
- Keep your API keys and bot token secure
- Use Supabase Row Level Security if deploying publicly

## License

MIT

## Support

If you encounter issues:

1. Check the logs: `pm2 logs whale-tracker` (if using PM2)
2. Enable debug logging: Set `LOG_LEVEL=debug` in `.env`
3. Review transaction data on Solscan to verify expected behavior

---

**Disclaimer**: This is for educational purposes. Not financial advice. Use at your own risk.
