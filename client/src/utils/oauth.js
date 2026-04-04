// OAuth utility constants and functions

export const OAUTH_POPUP_RESULT_STORAGE_KEY = 'oauth_popup_result';

// Helper function to handle OAuth popup result
export function handleOAuthPopupResult(token, error = null) {
  try {
    const result = error 
      ? { type: 'oauth-error', message: error }
      : { type: 'oauth-success', token };
    
    // Try to use postMessage first
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(result, window.location.origin);
    }
    
    // Fallback to localStorage
    localStorage.setItem(OAUTH_POPUP_RESULT_STORAGE_KEY, JSON.stringify(result));
    
    // Close popup
    window.close();
  } catch (err) {
    console.error('Error handling OAuth popup result:', err);
  }
}

// Helper function to parse OAuth popup result from storage
export function parseOAuthPopupResult(storageValue) {
  try {
    return JSON.parse(storageValue);
  } catch (_) {
    return null;
  }
}
