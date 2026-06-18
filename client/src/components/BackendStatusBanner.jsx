import React, { useEffect, useState } from 'react';

export function BackendStatusBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timeoutId;

    const schedule = (ms) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(check, ms);
    };

    const check = async () => {
      try {
        const res = await fetch('/api/health', { credentials: 'include' });
        if (cancelled) return;
        // Server responded — API is up (DB issues are reported in JSON, not as connection failure).
        setOffline(false);
        schedule(60000);
      } catch (_) {
        if (cancelled) return;
        setOffline(true);
        schedule(60000);
      }
    };

    check();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="bg-amber-500 text-white px-4 py-2 text-sm text-center">
      API server is offline. Start it with{' '}
      <code className="bg-black/20 px-1 rounded">npm run dev</code> from the project root, or run{' '}
      <code className="bg-black/20 px-1 rounded">cd server && npm run dev</code> in a separate terminal.
    </div>
  );
}
