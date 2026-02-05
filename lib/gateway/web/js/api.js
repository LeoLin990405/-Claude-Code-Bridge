/**
 * CCB Gateway Dashboard - API Client
 * Extracted from index.html for modular maintenance
 */

/**
 * Gateway API Client
 * Handles all HTTP requests to the Gateway backend
 */
class GatewayAPI {
    constructor(baseUrl = '') {
        this.baseUrl = baseUrl;
    }

    /**
     * Make HTTP request with error handling
     * @param {string} endpoint - API endpoint
     * @param {object} options - Fetch options
     * @returns {Promise<any>} Response data
     */
    async request(endpoint, options = {}) {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ detail: response.statusText }));
                throw new Error(error.detail || `HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`API Error [${endpoint}]:`, error);
            throw error;
        }
    }

    // ==================== Status APIs ====================

    /**
     * Get gateway status
     * @returns {Promise<object>} Status response with gateway and providers info
     */
    async getStatus() {
        return this.request('/api/status');
    }

    /**
     * Get recent requests
     * @param {object} params - Query parameters (limit, offset, status, provider)
     * @returns {Promise<object>} Requests list
     */
    async getRequests(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.request(`/api/requests${query ? '?' + query : ''}`);
    }

    /**
     * Get request details
     * @param {string} requestId - Request ID
     * @returns {Promise<object>} Request details
     */
    async getRequest(requestId) {
        return this.request(`/api/request/${requestId}`);
    }

    /**
     * Cancel a pending request
     * @param {string} requestId - Request ID
     * @returns {Promise<object>} Cancellation result
     */
    async cancelRequest(requestId) {
        return this.request(`/api/request/${requestId}`, { method: 'DELETE' });
    }

    // ==================== Provider APIs ====================

    /**
     * Toggle provider enabled state
     * @param {string} provider - Provider name
     * @param {boolean} enabled - Enable or disable
     * @returns {Promise<object>} Result
     */
    async toggleProvider(provider, enabled) {
        return this.request(`/api/provider/${provider}/toggle`, {
            method: 'POST',
            body: JSON.stringify({ enabled })
        });
    }

    /**
     * Get provider metrics
     * @param {string} provider - Provider name
     * @param {number} hours - Hours of history
     * @returns {Promise<object>} Metrics data
     */
    async getProviderMetrics(provider, hours = 24) {
        return this.request(`/api/provider/${provider}/metrics?hours=${hours}`);
    }

    // ==================== Request APIs ====================

    /**
     * Send a request to a provider
     * @param {object} data - Request data
     * @returns {Promise<object>} Response
     */
    async sendRequest(data) {
        const { wait = true, timeout = 120 } = data;
        return this.request(`/api/ask?wait=${wait}&timeout=${timeout}`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * Send parallel requests to multiple providers
     * @param {object} data - Request data with providers array
     * @returns {Promise<object>} Parallel response
     */
    async sendParallelRequest(data) {
        return this.request('/api/parallel', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // ==================== API Key APIs ====================

    /**
     * List API keys
     * @returns {Promise<Array>} API keys list
     */
    async listApiKeys() {
        return this.request('/api/keys');
    }

    /**
     * Create new API key
     * @param {object} data - Key data (name, rate_limit)
     * @returns {Promise<object>} Created key
     */
    async createApiKey(data) {
        return this.request('/api/keys', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * Delete API key
     * @param {string} keyId - Key ID
     * @returns {Promise<object>} Result
     */
    async deleteApiKey(keyId) {
        return this.request(`/api/keys/${keyId}`, { method: 'DELETE' });
    }

    /**
     * Toggle API key status
     * @param {string} keyId - Key ID
     * @returns {Promise<object>} Updated key
     */
    async toggleApiKey(keyId) {
        return this.request(`/api/keys/${keyId}/toggle`, { method: 'POST' });
    }

    // ==================== Cache APIs ====================

    /**
     * Get cache statistics
     * @returns {Promise<object>} Cache stats
     */
    async getCacheStats() {
        return this.request('/api/cache/stats');
    }

    /**
     * Clear cache
     * @returns {Promise<object>} Result
     */
    async clearCache() {
        return this.request('/api/cache/clear', { method: 'POST' });
    }

    /**
     * Cleanup expired cache entries
     * @returns {Promise<object>} Cleanup result
     */
    async cleanupCache() {
        return this.request('/api/cache/cleanup', { method: 'POST' });
    }

    // ==================== Cost APIs ====================

    /**
     * Get cost summary
     * @returns {Promise<object>} Cost summary
     */
    async getCostSummary() {
        return this.request('/api/costs/summary');
    }

    /**
     * Get cost by provider
     * @param {number} days - Number of days
     * @returns {Promise<Array>} Cost breakdown by provider
     */
    async getCostByProvider(days = 30) {
        return this.request(`/api/costs/by-provider?days=${days}`);
    }

    /**
     * Get cost by day
     * @param {number} days - Number of days
     * @returns {Promise<Array>} Daily cost breakdown
     */
    async getCostByDay(days = 7) {
        return this.request(`/api/costs/by-day?days=${days}`);
    }

    // ==================== Discussion APIs ====================

    /**
     * List discussions
     * @param {number} limit - Max results
     * @returns {Promise<object>} Discussions list
     */
    async listDiscussions(limit = 20) {
        return this.request(`/api/discussions?limit=${limit}`);
    }

    /**
     * Get discussion details
     * @param {string} discussionId - Discussion ID
     * @returns {Promise<object>} Discussion with messages
     */
    async getDiscussion(discussionId) {
        return this.request(`/api/discussions/${discussionId}`);
    }

    /**
     * Start new discussion
     * @param {object} data - Discussion config
     * @returns {Promise<object>} Created discussion
     */
    async startDiscussion(data) {
        return this.request('/api/discussions', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * Get discussion templates
     * @returns {Promise<Array>} Templates list
     */
    async getDiscussionTemplates() {
        return this.request('/api/discussions/templates');
    }

    // ==================== Memory APIs ====================

    /**
     * Get memory statistics
     * @returns {Promise<object>} Memory stats
     */
    async getMemoryStats() {
        return this.request('/api/memory/stats');
    }

    /**
     * List memory sessions
     * @param {number} limit - Max results
     * @returns {Promise<Array>} Sessions list
     */
    async listMemorySessions(limit = 50) {
        return this.request(`/api/memory/sessions?limit=${limit}`);
    }

    /**
     * Get session details
     * @param {string} sessionId - Session ID
     * @returns {Promise<object>} Session with messages
     */
    async getMemorySession(sessionId) {
        return this.request(`/api/memory/sessions/${sessionId}`);
    }

    /**
     * Search memory
     * @param {string} query - Search query
     * @param {number} limit - Max results
     * @returns {Promise<object>} Search results
     */
    async searchMemory(query, limit = 20) {
        return this.request(`/api/memory/search?query=${encodeURIComponent(query)}&limit=${limit}`);
    }

    // ==================== Skills APIs ====================

    /**
     * Get skills statistics
     * @returns {Promise<object>} Skills stats
     */
    async getSkillsStats() {
        return this.request('/api/skills/stats');
    }

    /**
     * Search for skill recommendations
     * @param {string} query - Search query
     * @returns {Promise<object>} Recommendations
     */
    async searchSkills(query) {
        return this.request(`/api/skills/search?query=${encodeURIComponent(query)}`);
    }
}

// Create singleton instance
const api = new GatewayAPI();

// Export for ES modules (if used)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GatewayAPI, api };
}
