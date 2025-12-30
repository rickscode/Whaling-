import axios, { AxiosInstance } from 'axios';
import { HELIUS_API_KEY, HELIUS_API_URL } from '../config/constants';
import { HeliusTransaction } from '../types';

class HeliusService {
    private client: AxiosInstance;

    constructor() {
        this.client = axios.create({
            baseURL: HELIUS_API_URL,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    /**
     * Fetch recent transactions for a wallet address
     */
    async getWalletTransactions(address: string, limit: number = 10): Promise<HeliusTransaction[]> {
        try {
            const response = await this.client.get(`/addresses/${address}/transactions`, {
                params: {
                    'api-key': HELIUS_API_KEY,
                    limit
                }
            });

            return response.data as HeliusTransaction[];
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.error(`Helius API error for wallet ${address}:`, {
                    status: error.response?.status,
                    message: error.response?.data?.error || error.message
                });

                // Handle rate limiting
                if (error.response?.status === 429) {
                    console.warn('Rate limit exceeded. Consider reducing poll frequency or upgrading Helius plan.');
                }
            } else {
                console.error(`Unexpected error fetching transactions for ${address}:`, error);
            }

            throw error;
        }
    }

    /**
     * Test Helius API connection
     */
    async testConnection(): Promise<boolean> {
        try {
            // Test with a known whale wallet
            await this.getWalletTransactions('6FNy8RFVYoWUZU4TcsjwYp9dSCxe9GUxELg5qy4oekbS', 1);
            console.log('Helius API connection successful');
            return true;
        } catch (error) {
            console.error('Helius API connection failed:', error);
            return false;
        }
    }
}

// Export singleton instance
export const heliusService = new HeliusService();
