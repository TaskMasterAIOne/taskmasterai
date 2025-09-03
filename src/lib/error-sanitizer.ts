/**
 * Sanitizes error messages to prevent API key leaks
 * This utility ensures that sensitive information like API keys, tokens, and other secrets
 * are not exposed in error messages that might be displayed to users or logged.
 */
export function sanitizeErrorMessage(error: any): string {
  if (!error) return "Unknown error occurred";
  
  let message = typeof error === 'string' ? error : (error.message || error.toString());
  
  // Remove API keys from URLs - matches key=APIKEY pattern
  message = message.replace(/[?&]key=[A-Za-z0-9_-]+/g, '?key=***');
  
  // Remove any standalone API keys that look like Google API keys
  message = message.replace(/AIza[A-Za-z0-9_-]{35}/g, 'AIza***');
  
  // Remove other common API key patterns
  message = message.replace(/sk-[A-Za-z0-9]{32,}/g, 'sk-***'); // OpenAI keys
  message = message.replace(/Bearer [A-Za-z0-9_-]{20,}/g, 'Bearer ***'); // Bearer tokens
  message = message.replace(/token=[A-Za-z0-9_-]{20,}/g, 'token=***'); // Token parameters
  
  // Remove any other potential API key patterns (long alphanumeric strings)
  message = message.replace(/[A-Za-z0-9]{32,}/g, (match: string) => {
    // If it looks like an API key (long alphanumeric string), mask it
    if (match.length >= 32 && /^[A-Za-z0-9_-]+$/.test(match)) {
      return match.substring(0, 4) + '***';
    }
    return match;
  });
  
  // Remove potential secrets from URLs
  message = message.replace(/([?&])(secret|token|key|auth)=[^&\s]+/gi, '$1$2=***');
  
  return message;
}

/**
 * Sanitizes error objects for logging purposes
 * This ensures that sensitive data is not logged while preserving the error structure
 */
export function sanitizeErrorForLogging(error: any): any {
  if (!error) return error;
  
  // If it's a string, sanitize directly
  if (typeof error === 'string') {
    return sanitizeErrorMessage(error);
  }
  
  // If it's an Error object or has a message property
  if (error.message) {
    return {
      ...error,
      message: sanitizeErrorMessage(error.message),
      stack: error.stack ? sanitizeErrorMessage(error.stack) : undefined
    };
  }
  
  return error;
}
