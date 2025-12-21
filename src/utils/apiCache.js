/**
 * API Cache and Rate Limiter for LeetCode API
 * 
 * This utility helps prevent 429 (Too Many Requests) errors by:
 * 1. Caching API responses with TTL (Time To Live)
 * 2. Rate limiting requests with exponential backoff
 * 3. Batching concurrent requests to the same endpoint
 */

class APICache {
    constructor() {
        this.cache = new Map();
        this.pendingRequests = new Map();
        this.requestQueue = [];
        this.isProcessing = false;
        this.lastRequestTime = 0;
        this.minRequestInterval = 200; // Minimum 200ms between requests
        this.retryDelays = [1000, 2000, 5000]; // Exponential backoff delays
    }

    /**
     * Get cache key from URL
     */
    getCacheKey(url) {
        // Remove cache-busting parameters
        return url.split('?')[0];
    }

    /**
     * Check if cached data is still valid
     */
    isCacheValid(cacheEntry, ttl = 60000) {
        if (!cacheEntry) return false;
        return Date.now() - cacheEntry.timestamp < ttl;
    }

    /**
     * Get data from cache
     */
    getFromCache(url, ttl = 60000) {
        const key = this.getCacheKey(url);
        const entry = this.cache.get(key);

        if (this.isCacheValid(entry, ttl)) {
            console.log(`[API Cache] Cache hit for ${key}`);
            return entry.data;
        }

        return null;
    }

    /**
     * Store data in cache
     */
    setCache(url, data) {
        const key = this.getCacheKey(url);
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
        console.log(`[API Cache] Cached ${key}`);
    }

    /**
     * Clear cache for a specific URL or all cache
     */
    clearCache(url = null) {
        if (url) {
            const key = this.getCacheKey(url);
            this.cache.delete(key);
            console.log(`[API Cache] Cleared cache for ${key}`);
        } else {
            this.cache.clear();
            console.log(`[API Cache] Cleared all cache`);
        }
    }

    /**
     * Wait for minimum interval between requests
     */
    async waitForRateLimit() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;

        if (timeSinceLastRequest < this.minRequestInterval) {
            const waitTime = this.minRequestInterval - timeSinceLastRequest;
            console.log(`[API Rate Limit] Waiting ${waitTime}ms before next request`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        this.lastRequestTime = Date.now();
    }

    /**
     * Fetch with caching and rate limiting
     */
    async fetchWithCache(url, options = {}) {
        const {
            ttl = 60000, // Cache TTL in milliseconds (default 1 minute)
            forceRefresh = false,
            retries = 2
        } = options;

        // Check cache first (unless force refresh)
        if (!forceRefresh) {
            const cachedData = this.getFromCache(url, ttl);
            if (cachedData !== null) {
                return cachedData;
            }
        }

        // Check if there's already a pending request for this URL
        const cacheKey = this.getCacheKey(url);
        if (this.pendingRequests.has(cacheKey)) {
            console.log(`[API Cache] Waiting for pending request: ${cacheKey}`);
            return this.pendingRequests.get(cacheKey);
        }

        // Create new request promise
        const requestPromise = this._executeRequest(url, retries);
        this.pendingRequests.set(cacheKey, requestPromise);

        try {
            const data = await requestPromise;
            this.setCache(url, data);
            return data;
        } finally {
            this.pendingRequests.delete(cacheKey);
        }
    }

    /**
     * Execute the actual HTTP request with retry logic
     */
    async _executeRequest(url, retries) {
        let lastError;

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                // Wait for rate limit
                await this.waitForRateLimit();

                console.log(`[API Request] Fetching ${url} (attempt ${attempt + 1}/${retries + 1})`);

                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache',
                        'Expires': '0'
                    },
                    cache: 'no-store'
                });

                // Handle rate limiting
                if (response.status === 429) {
                    const retryAfter = response.headers.get('Retry-After');
                    const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : this.retryDelays[attempt] || 5000;

                    console.warn(`[API Rate Limit] 429 received, waiting ${waitTime}ms before retry`);

                    if (attempt < retries) {
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        continue;
                    } else {
                        throw new Error('Rate limit exceeded, max retries reached');
                    }
                }

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                console.log(`[API Request] Success for ${url}`);
                return data;

            } catch (error) {
                lastError = error;
                console.error(`[API Request] Attempt ${attempt + 1} failed:`, error.message);

                // If it's the last attempt, throw the error
                if (attempt === retries) {
                    throw lastError;
                }

                // Wait before retrying (exponential backoff)
                const waitTime = this.retryDelays[attempt] || 2000;
                console.log(`[API Request] Retrying in ${waitTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }

        throw lastError;
    }

    /**
     * Batch fetch multiple URLs with rate limiting
     */
    async batchFetch(urls, options = {}) {
        const {
            ttl = 60000,
            forceRefresh = false,
            concurrency = 2 // Max concurrent requests
        } = options;

        const results = [];
        const chunks = [];

        // Split URLs into chunks based on concurrency
        for (let i = 0; i < urls.length; i += concurrency) {
            chunks.push(urls.slice(i, i + concurrency));
        }

        // Process chunks sequentially, but URLs within a chunk concurrently
        for (const chunk of chunks) {
            const chunkResults = await Promise.all(
                chunk.map(url =>
                    this.fetchWithCache(url, { ttl, forceRefresh })
                        .catch(error => {
                            console.error(`[API Batch] Failed to fetch ${url}:`, error);
                            return { error: true, message: error.message };
                        })
                )
            );
            results.push(...chunkResults);
        }

        return results;
    }
}

// Export singleton instance
export const apiCache = new APICache();

// Export helper functions
export const fetchWithCache = (url, options) => apiCache.fetchWithCache(url, options);
export const batchFetch = (urls, options) => apiCache.batchFetch(urls, options);
export const clearCache = (url) => apiCache.clearCache(url);
