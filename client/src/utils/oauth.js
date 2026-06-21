// OAuth utility constants and functions

export const OAUTH_POPUP_RESULT_STORAGE_KEY = 'oauth_popup_result';

export function handleOAuthPopupResult(token, error = null) {
  try {
    const result = error
      ? { type: 'oauth-error', message: error }
      : { type: 'oauth-success', token: token || null };

    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(result, window.location.origin);
    }

    window.close();
  } catch (err) {
    console.error('Error handling OAuth popup result:', err);
  }
}

export function parseOAuthPopupResult(storageValue) {
  try {
    return JSON.parse(storageValue);
  } catch (_) {
    return null;
  }
}
