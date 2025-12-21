/**
 * LeetCode Username Validation
 * Verifies that usernames exist on LeetCode before adding them
 */

const API_BASE_URL = "https://alfa-leetcode-api.onrender.com";

// Cache for validated usernames (5 minutes TTL)
const validationCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Validate a LeetCode username by checking if it exists
 */
export const validateLeetCodeUsername = async (username, fetchWithRetry) => {
    if (!username || typeof username !== 'string') {
        return { valid: false, error: 'Username is required' };
    }

    const cleanUsername = username.trim();

    if (cleanUsername.length === 0) {
        return { valid: false, error: 'Username cannot be empty' };
    }

    if (cleanUsername.length > 30) {
        return { valid: false, error: 'Username too long (max 30 characters)' };
    }

    // Check cache first
    const cached = validationCache.get(cleanUsername);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`[Username Validation] Cache hit for ${cleanUsername}`);
        return cached.result;
    }

    try {
        console.log(`[Username Validation] Validating ${cleanUsername}...`);

        // Fetch user profile from LeetCode API
        const response = await fetchWithRetry(`${API_BASE_URL}/${cleanUsername}`, {
            ttl: 300000 // 5 minute cache
        });

        if (response && !response.errors && response.username) {
            const result = {
                valid: true,
                username: response.username,
                avatar: response.avatar,
                ranking: response.ranking
            };

            // Cache the result
            validationCache.set(cleanUsername, {
                result,
                timestamp: Date.now()
            });

            console.log(`[Username Validation] ✓ ${cleanUsername} is valid`);
            return result;
        }

        const result = { valid: false, error: 'Username not found on LeetCode' };

        // Cache negative results too (shorter TTL)
        validationCache.set(cleanUsername, {
            result,
            timestamp: Date.now() - (CACHE_TTL / 2) // Expire faster for negative results
        });

        console.log(`[Username Validation] ✗ ${cleanUsername} not found`);
        return result;

    } catch (error) {
        console.error(`[Username Validation] Error validating ${cleanUsername}:`, error);

        // Don't cache errors
        return {
            valid: false,
            error: 'Failed to verify username. Please try again.'
        };
    }
};

/**
 * Validate multiple usernames at once
 */
export const validateMultipleUsernames = async (usernames, fetchWithRetry, onProgress) => {
    const results = [];

    for (let i = 0; i < usernames.length; i++) {
        const username = usernames[i];
        const result = await validateLeetCodeUsername(username, fetchWithRetry);

        results.push({
            username,
            ...result
        });

        // Call progress callback if provided
        if (onProgress) {
            onProgress(i + 1, usernames.length, result);
        }

        // Small delay to avoid rate limiting
        if (i < usernames.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    return results;
};

/**
 * Clear validation cache
 */
export const clearValidationCache = () => {
    validationCache.clear();
    console.log('[Username Validation] Cache cleared');
};
