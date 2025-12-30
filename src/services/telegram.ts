import TelegramBot from 'node-telegram-bot-api';
import { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } from '../config/constants';
import { BuyNotificationData, SellNotificationData } from '../types';
import { formatHoldDuration, formatUSD, formatPercent } from '../utils/filters';

class TelegramService {
    private bot: TelegramBot;
    private chatId: string;

    constructor() {
        this.bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });
        this.chatId = TELEGRAM_CHAT_ID;
    }

    /**
     * Send a buy notification
     */
    async sendBuyNotification(data: BuyNotificationData): Promise<void> {
        const walletDisplay = data.walletLabel || this.truncateAddress(data.walletAddress);

        const message = `
<b>BUY ALERT</b>

<b>Wallet:</b> ${walletDisplay}
<code>${data.walletAddress}</code>

<b>Token:</b> ${data.tokenSymbol}
${data.tokenName !== data.tokenSymbol ? `<i>${data.tokenName}</i>` : ''}

<b>Amount:</b> ${data.amount.toLocaleString()}
<b>Price:</b> $${data.priceUsd.toFixed(6)}
<b>Value:</b> ${formatUSD(data.valueUsd)}

<a href="https://solscan.io/tx/${data.signature}">View Transaction</a>
        `.trim();

        try {
            await this.bot.sendMessage(this.chatId, message, { parse_mode: 'HTML' });
        } catch (error) {
            console.error('Error sending buy notification:', error);
            throw error;
        }
    }

    /**
     * Send a sell notification
     */
    async sendSellNotification(data: SellNotificationData): Promise<void> {
        const walletDisplay = data.walletLabel || this.truncateAddress(data.walletAddress);
        const profitEmoji = data.profitLossPercent >= 0 ? '' : '';
        const holdDuration = formatHoldDuration(data.holdDurationSeconds);

        const message = `
${profitEmoji} <b>SELL ALERT</b>

<b>Wallet:</b> ${walletDisplay}
<code>${data.walletAddress}</code>

<b>Token:</b> ${data.tokenSymbol}
${data.tokenName !== data.tokenSymbol ? `<i>${data.tokenName}</i>` : ''}

<b>Amount:</b> ${data.amount.toLocaleString()}

<b>Buy Price:</b> $${data.buyPriceUsd.toFixed(6)}
<b>Sell Price:</b> $${data.sellPriceUsd.toFixed(6)}

<b>Buy Value:</b> ${formatUSD(data.buyValueUsd)}
<b>Sell Value:</b> ${formatUSD(data.sellValueUsd)}

<b>P&L:</b> ${formatUSD(data.profitLossUsd)} (${formatPercent(data.profitLossPercent)})
<b>Hold Time:</b> ${holdDuration}

<a href="https://solscan.io/tx/${data.signature}">View Transaction</a>
        `.trim();

        try {
            await this.bot.sendMessage(this.chatId, message, { parse_mode: 'HTML' });
        } catch (error) {
            console.error('Error sending sell notification:', error);
            throw error;
        }
    }

    /**
     * Test Telegram bot connection
     */
    async testConnection(): Promise<boolean> {
        try {
            const me = await this.bot.getMe();
            console.log(`Telegram bot connected: @${me.username}`);
            return true;
        } catch (error) {
            console.error('Telegram bot connection failed:', error);
            return false;
        }
    }

    /**
     * Truncate wallet address for display
     */
    private truncateAddress(address: string): string {
        return `${address.slice(0, 4)}...${address.slice(-4)}`;
    }
}

// Export singleton instance
export const telegramService = new TelegramService();
