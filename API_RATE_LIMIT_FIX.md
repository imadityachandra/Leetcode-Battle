# LeetCode API Rate Limiting Fix (429 Error)

## 🐛 Problem

The app was frequently receiving **429 (Too Many Requests)** errors from the LeetCode API wrapper (`alfa-leetcode-api.onrender.com`), causing:
- Failed leaderboard updates
- "Some users unreachable" errors
- Poor user experience
- Inability to fetch submission data during wars

## 🔍 Root Causes

1. **No Caching**: Every sync made fresh API calls, even for data that hadn't changed
2. **Aggressive Auto-Sync**: Leaderboard refreshed every time `friendUsernames` changed
3. **No Rate Limiting**: Multiple concurrent requests without delays
4. **Duplicate Requests**: Same endpoints called multiple times simultaneously
5. **Cache Busting**: Added `_t=${Date.now()}` to every request, preventing browser caching

### API Call Frequency (Before Fix)
```
Per User: 3 API calls (profile + solved + submissions)
5 Users: 15 API calls per sync
Auto-sync triggers: Username changes, manual sync, war checks
Estimated: 50-100+ API calls per minute during active usage
```

## ✅ Solution

Implemented a comprehensive **API Caching and Rate Limiting** system with:

### 1. Intelligent Caching (`src/utils/apiCache.js`)
- **TTL-based cache**: Default 60 seconds (configurable)
- **Automatic cache invalidation**: Old data automatically expires
- **Memory-efficient**: Uses Map for O(1) lookups
- **Cache key normalization**: Removes query parameters for better hit rate

### 2. Rate Limiting
- **Minimum request interval**: 200ms between requests
- **Exponential backoff**: 1s → 2s → 5s retry delays
- **429 handling**: Respects `Retry-After` header
- **Request queuing**: Prevents burst requests

### 3. Request Deduplication
- **Pending request tracking**: Multiple calls to same endpoint share one request
- **Concurrent request batching**: Limits to 2 concurrent requests per batch
- **Promise sharing**: Waiting requests get same result

### 4. Smart Refresh Strategy
- **Auto-sync**: Uses cached data (60s TTL)
- **Manual "Sync Now"**: Forces fresh data (`forceRefresh=true`)
- **War submission checks**: Uses cached data to reduce load

## 📊 Impact

### API Call Reduction
```
Before: 15 calls per sync × frequent syncs = 50-100+ calls/min
After:  15 calls first sync, then 0 calls for 60s = ~15 calls/min (83% reduction)
```

### Cache Hit Rates (Expected)
- **Profile data**: ~90% hit rate (rarely changes)
- **Solved stats**: ~80% hit rate (changes slowly)
- **Submissions**: ~60% hit rate (changes more frequently)

### User Experience Improvements
- ✅ Fewer 429 errors
- ✅ Faster perceived performance (instant cache hits)
- ✅ Reduced "Some users unreachable" errors
- ✅ More reliable war submission tracking

## 🔧 Implementation Details

### New File: `src/utils/apiCache.js`

**Key Features:**
```javascript
class APICache {
  // Cache with TTL
  fetchWithCache(url, { ttl = 60000, forceRefresh = false })
  
  // Batch requests with rate limiting
  batchFetch(urls, { concurrency = 2 })
  
  // Manual cache control
  clearCache(url)
}
```

### Updated: `src/App.jsx`

**Changes:**
1. **Import cache utility**:
   ```javascript
   import { fetchWithCache, clearCache } from "./utils/apiCache";
   ```

2. **Updated `fetchWithRetry`**:
   ```javascript
   const fetchWithRetry = useCallback(async (url, options = {}) => {
     const { ttl = 60000, forceRefresh = false } = options;
     return await fetchWithCache(url, { ttl, forceRefresh, retries: 2 });
   }, []);
   ```

3. **Updated `fetchAllUsersData`**:
   ```javascript
   const fetchAllUsersData = useCallback(async (forceRefresh = false) => {
     // Uses cache by default, forces refresh when explicitly requested
     const [profile, solved, submission] = await Promise.all([
       fetchWithRetry(`${API_BASE_URL}/${user}`, { forceRefresh }),
       // ...
     ]);
   }, [friendUsernames, currentUserId, fetchWithRetry]);
   ```

4. **Updated "Sync Now" button**:
   ```javascript
   <button onClick={() => fetchAllUsersData(true)}>Sync Now</button>
   // Passes true to force fresh data
   ```

## 📈 Configuration Options

### Cache TTL (Time To Live)
```javascript
// Default: 60 seconds
fetchWithRetry(url, { ttl: 60000 })

// Longer cache for stable data
fetchWithRetry(url, { ttl: 300000 }) // 5 minutes

// Shorter cache for dynamic data
fetchWithRetry(url, { ttl: 30000 }) // 30 seconds
```

### Force Refresh
```javascript
// Use cache if available
fetchWithRetry(url)

// Bypass cache, fetch fresh data
fetchWithRetry(url, { forceRefresh: true })
```

### Rate Limiting
```javascript
// Configured in apiCache.js
minRequestInterval: 200ms  // Minimum time between requests
retryDelays: [1000, 2000, 5000]  // Exponential backoff
```

## 🧪 Testing

### Test Scenario 1: Normal Usage
1. Add 5 users to room
2. Observe initial API calls (15 total)
3. Wait 30 seconds
4. Add another user
5. **Expected**: Only 3 new API calls (for new user), others cached

### Test Scenario 2: Manual Sync
1. Click "Sync Now"
2. **Expected**: All data refreshed (cache bypassed)
3. Click "Sync Now" again immediately
4. **Expected**: Fresh API calls (no cache)

### Test Scenario 3: Rate Limit Handling
1. Simulate 429 error (modify API or use network throttling)
2. **Expected**: Exponential backoff, retry after delay
3. **Expected**: Error logged but app continues working

### Test Scenario 4: Cache Expiration
1. Load leaderboard
2. Wait 61 seconds (past TTL)
3. Trigger auto-sync
4. **Expected**: Fresh API calls (cache expired)

## 🔍 Monitoring

### Console Logs
```
[API Cache] Cache hit for https://alfa-leetcode-api.onrender.com/username
[API Cache] Cached https://alfa-leetcode-api.onrender.com/username
[API Request] Fetching https://... (attempt 1/3)
[API Request] Success for https://...
[API Rate Limit] Waiting 200ms before next request
[API Rate Limit] 429 received, waiting 2000ms before retry
```

### Cache Statistics (Future Enhancement)
```javascript
// Add to apiCache.js
getCacheStats() {
  return {
    size: this.cache.size,
    hits: this.cacheHits,
    misses: this.cacheMisses,
    hitRate: this.cacheHits / (this.cacheHits + this.cacheMisses)
  };
}
```

## 🚀 Future Improvements

1. **Persistent Cache**: Use IndexedDB for cache that survives page reloads
2. **Smart TTL**: Adjust TTL based on data type (profiles vs submissions)
3. **Background Refresh**: Refresh cache in background before expiration
4. **Cache Warming**: Pre-fetch data for known users
5. **Analytics**: Track cache hit rates and API usage
6. **Fallback API**: Use multiple API endpoints with automatic failover

## 📝 Best Practices

### When to Force Refresh
- ✅ User clicks "Sync Now"
- ✅ Starting a new war
- ✅ After user completes a submission
- ❌ Auto-sync on timer
- ❌ Adding/removing users (use cache)

### Cache TTL Guidelines
- **User profiles**: 5 minutes (rarely change)
- **Solved stats**: 1 minute (change slowly)
- **Submissions**: 30 seconds (change frequently during wars)

### Error Handling
- **429 errors**: Retry with exponential backoff
- **Network errors**: Retry up to 2 times
- **Timeout**: Set reasonable timeout (10s)
- **Fallback**: Show cached data if available

---

**Status**: ✅ **IMPLEMENTED**  
**Date**: December 21, 2025  
**Complexity**: 8/10 (Significant system-wide optimization)  
**Impact**: High (Prevents service disruption, improves UX)
