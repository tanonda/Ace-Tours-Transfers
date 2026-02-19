/**
 * Safely extracts descriptive details from complex error objects like 
 * ErrorEvent, AggregateError, and standard Error instances.
 * 
 * Specifically handles the Neon/WebSocket driver's ErrorEvent/AggregateError 
 * structures which often result in "[object Object]" when stringified.
 */
export function extractErrorDetails(error: any) {
    if (!error) return { message: 'Unknown error' };

    const details: any = {
        message: error.message || String(error),
        code: error.code,
        stack: error.stack,
    };

    // Handle AggregateError (common in Neon timeouts)
    if (Array.isArray(error.errors)) {
        details.errors = error.errors.map((e: any) => ({
            message: e.message,
            code: e.code,
            stack: e.stack
        }));

        // If we have multiple errors, improve the top-level message
        if (details.message === '[object Object]' && error.errors.length > 0) {
            details.message = error.errors[0]?.message || 'AggregateError';
        }
    }

    // Handle ErrorEvent (common in WebSocket failures)
    if (error.error && typeof error.error === 'object') {
        const nested = extractErrorDetails(error.error);
        details.nested = nested;
        if (details.message === '[object Object]') {
            details.message = nested.message;
        }
    }

    // Final fallback for opaque objects
    if (details.message === '[object Object]') {
        details.message = 'Opaque error object (see details)';
    }

    return details;
}
