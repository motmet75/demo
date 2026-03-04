// Token Manager - Handles token storage and retrieval
const fs = require('fs').promises;
const path = require('path');

const TOKEN_FILE = path.join(__dirname, 'tokens.json');

class TokenManager {
    constructor() {
        this.tokens = {};
        this.loadTokens();
    }

    // Load tokens from file
    async loadTokens() {
        try {
            const data = await fs.readFile(TOKEN_FILE, 'utf8');
            this.tokens = JSON.parse(data);
            console.log('✅ Tokens loaded from file');
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log('📝 No existing token file found, creating new one');
                this.tokens = {};
                await this.saveTokens();
            } else {
                console.error('Error loading tokens:', error.message);
            }
        }
    }

    // Save tokens to file
    async saveTokens() {
        try {
            await fs.writeFile(TOKEN_FILE, JSON.stringify(this.tokens, null, 2));
            console.log('💾 Tokens saved to file');
        } catch (error) {
            console.error('Error saving tokens:', error.message);
        }
    }

    // Store a new token
    async storeToken(userId, tokenData) {
        this.tokens[userId] = {
            ...tokenData,
            createdAt: new Date().toISOString(),
            lastUsed: new Date().toISOString()
        };
        await this.saveTokens();
        return this.tokens[userId];
    }

    // Get token by user ID
    getToken(userId) {
        const tokenData = this.tokens[userId];
        if (tokenData) {
            // Update last used time
            tokenData.lastUsed = new Date().toISOString();
            this.saveTokens();
            return tokenData.token;
        }
        return null;
    }

    // Get all token data for a user
    getTokenData(userId) {
        return this.tokens[userId];
    }

    // Remove token
    async removeToken(userId) {
        delete this.tokens[userId];
        await this.saveTokens();
    }

    // Check if token exists and is valid
    hasValidToken(userId) {
        const tokenData = this.tokens[userId];
        if (!tokenData) return false;

        // Check if token is expired (tokens typically valid for 24 hours)
        const createdAt = new Date(tokenData.createdAt);
        const now = new Date();
        const hoursSinceCreation = (now - createdAt) / (1000 * 60 * 60);

        if (hoursSinceCreation > 24) {
            this.removeToken(userId);
            return false;
        }

        return true;
    }

    // Get all stored tokens (for admin purposes)
    getAllTokens() {
        return this.tokens;
    }

    // Clean expired tokens
    async cleanExpiredTokens() {
        const now = new Date();
        let cleaned = 0;

        for (const [userId, tokenData] of Object.entries(this.tokens)) {
            const createdAt = new Date(tokenData.createdAt);
            const hoursSinceCreation = (now - createdAt) / (1000 * 60 * 60);

            if (hoursSinceCreation > 24) {
                delete this.tokens[userId];
                cleaned++;
            }
        }

        if (cleaned > 0) {
            await this.saveTokens();
            console.log(`🧹 Cleaned ${cleaned} expired tokens`);
        }

        return cleaned;
    }
}

module.exports = new TokenManager();
