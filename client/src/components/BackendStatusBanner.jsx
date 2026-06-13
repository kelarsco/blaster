import React, { useEffect, useState } from 'react';

export function BackendStatusBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch('/api/health', { credentials: 'include' });
        if (!cancelled) setOffline(!res.ok);
      } catch (_) {
        if (!cancelled) setOffline(true);
      }
    };

    check();
    const interval = setInterval(check, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
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
