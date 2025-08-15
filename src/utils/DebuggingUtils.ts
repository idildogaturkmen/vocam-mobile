// Debugging utilities to help identify duplicate operations and performance issues

class OperationTracker {
    private operations: Map<string, { count: number; lastCall: number }> = new Map();
    private readonly DUPLICATE_THRESHOLD = 10000; // 10 seconds

    /**
     * Track an operation and warn if it's called too frequently
     */
    track(operation: string, context?: string): boolean {
        const key = context ? `${operation}_${context}` : operation;
        const now = Date.now();
        const existing = this.operations.get(key);

        if (existing) {
            const timeSinceLastCall = now - existing.lastCall;
            existing.count++;
            existing.lastCall = now;

            // Warn if called multiple times within threshold
            if (timeSinceLastCall < this.DUPLICATE_THRESHOLD) {
                console.warn(
                    `🚨 [DebuggingUtils] Potential duplicate operation detected:`,
                    `\n  Operation: ${operation}`,
                    context ? `\n  Context: ${context}` : '',
                    `\n  Call count: ${existing.count}`,
                    `\n  Time since last call: ${timeSinceLastCall}ms`,
                    `\n  Stack trace:`, 
                    new Error().stack?.split('\n').slice(2, 5).join('\n')
                );
                return false; // Indicates potential duplicate
            }
        } else {
            this.operations.set(key, { count: 1, lastCall: now });
        }

        return true; // Operation is okay to proceed
    }

    /**
     * Get statistics about tracked operations
     */
    getStats(): { [key: string]: { count: number; lastCall: Date } } {
        const stats: { [key: string]: { count: number; lastCall: Date } } = {};
        
        for (const [key, data] of this.operations.entries()) {
            stats[key] = {
                count: data.count,
                lastCall: new Date(data.lastCall)
            };
        }
        
        return stats;
    }

    /**
     * Clear old operation tracking data
     */
    cleanup(maxAge: number = 300000): void { // 5 minutes default
        const now = Date.now();
        
        for (const [key, data] of this.operations.entries()) {
            if (now - data.lastCall > maxAge) {
                this.operations.delete(key);
            }
        }
    }

    /**
     * Reset all tracking data
     */
    reset(): void {
        this.operations.clear();
    }
}

// Singleton instance
const operationTracker = new OperationTracker();

// Export debugging functions
export const debugUtils = {
    /**
     * Track XP operations to detect duplicates
     */
    trackXPAward: (userId: string, type: string, amount?: number) => {
        const context = `${userId}_${type}_${amount || 'default'}`;
        return operationTracker.track('XP_AWARD', context);
    },

    /**
     * Track achievement checks to detect duplicates
     */
    trackAchievementCheck: (userId: string) => {
        return operationTracker.track('ACHIEVEMENT_CHECK', userId);
    },

    /**
     * Track login processing to detect duplicates
     */
    trackLoginProcess: (userId: string) => {
        const today = new Date().toDateString();
        return operationTracker.track('LOGIN_PROCESS', `${userId}_${today}`);
    },

    /**
     * Track cache operations
     */
    trackCacheOperation: (operation: string, key: string) => {
        return operationTracker.track('CACHE_OP', `${operation}_${key}`);
    },

    /**
     * Track database operations
     */
    trackDBOperation: (operation: string, table: string, userId?: string) => {
        const context = userId ? `${table}_${userId}` : table;
        return operationTracker.track(`DB_${operation.toUpperCase()}`, context);
    },

    /**
     * Get operation statistics
     */
    getOperationStats: () => operationTracker.getStats(),

    /**
     * Clean up old tracking data
     */
    cleanup: () => operationTracker.cleanup(),

    /**
     * Reset all tracking
     */
    reset: () => operationTracker.reset(),

    /**
     * Log performance timing
     */
    time: <T>(operation: string, fn: () => T): T => {
        const start = performance.now();
        const result = fn();
        const end = performance.now();
        
        console.log(`⏱️ [Performance] ${operation}: ${(end - start).toFixed(2)}ms`);
        return result;
    },

    /**
     * Log async performance timing
     */
    timeAsync: async <T>(operation: string, fn: () => Promise<T>): Promise<T> => {
        const start = performance.now();
        const result = await fn();
        const end = performance.now();
        
        console.log(`⏱️ [Performance] ${operation}: ${(end - start).toFixed(2)}ms`);
        return result;
    }
};

// Cleanup old data every 5 minutes
if (typeof setInterval !== 'undefined') {
    setInterval(() => {
        operationTracker.cleanup();
    }, 300000);
}

export default debugUtils;