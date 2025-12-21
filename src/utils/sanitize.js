/**
 * Input Sanitization Utilities
 * Prevents XSS attacks and validates user input
 */

/**
 * Sanitize text input by removing HTML tags and limiting length
 */
export const sanitizeInput = (input, maxLength = 100) => {
    if (!input) return '';

    // Convert to string
    const str = String(input);

    // Remove HTML tags
    const withoutHtml = str.replace(/<[^>]*>/g, '');

    // Remove script tags (extra safety)
    const withoutScripts = withoutHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // Remove potentially dangerous characters
    const safe = withoutScripts.replace(/[<>]/g, '');

    // Trim whitespace and limit length
    return safe.trim().slice(0, maxLength);
};

/**
 * Sanitize username (alphanumeric, hyphens, underscores only)
 */
export const sanitizeUsername = (username) => {
    if (!username) return '';

    // Only allow alphanumeric, hyphens, underscores
    const cleaned = String(username).replace(/[^a-zA-Z0-9_-]/g, '');

    // Limit length
    return cleaned.slice(0, 30);
};

/**
 * Sanitize room name
 */
export const sanitizeRoomName = (roomName) => {
    if (!roomName) return '';

    // Allow alphanumeric, spaces, hyphens, underscores
    const cleaned = String(roomName).replace(/[^a-zA-Z0-9 _-]/g, '');

    // Trim and limit length
    return cleaned.trim().slice(0, 50);
};

/**
 * Sanitize chat message
 */
export const sanitizeChatMessage = (message) => {
    return sanitizeInput(message, 500);
};

/**
 * Validate email format
 */
export const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

/**
 * Validate URL format
 */
export const isValidUrl = (url) => {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
};
