import React, { useEffect, useState } from 'react';
import { storeDisplayName, storeFaviconUrl } from '../../utils/storeDisplay.js';

/** Preloads favicon off-DOM; only renders img after a successful load (avoids 404 img src in React tree). */
export function StoreSiteLogo({ storeUrl }) {
  const displayName = storeDisplayName(storeUrl);
  const letter = displayName.charAt(0).toUpperCase();
  const [faviconSrc, setFaviconSrc] = useState(null);

  useEffect(() => {
    const url = storeFaviconUrl(storeUrl);
    if (!url) {
      setFaviconSrc(null);
      return undefined;
    }

    let cancelled = false;
    setFaviconSrc(null);
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.onload = () => {
      if (!cancelled) setFaviconSrc(url);
    };
    img.onerror = () => {
      if (!cancelled) setFaviconSrc(null);
    };
    img.src = url;

    return () => {
      cancelled = true;
    };
  }, [storeUrl]);

  if (faviconSrc) {
    return <img src={faviconSrc} alt="" referrerPolicy="no-referrer" />;
  }

  return letter;
}
