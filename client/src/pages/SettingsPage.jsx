import React, { useState, useEffect } from 'react';

const STORAGE_KEY = 'blaster-settings';

const DEFAULT_SETTINGS = {
  delayBetweenEmails: 1,
  maxConcurrentCrawlers: 6,
  maxUrlsPerScan: 1000,
  crawledPaths: ['/', '/contact', '/about', '/privacy', '/pages/contact', '/policies/privacy-policy'],
};

export function SettingsPage() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setSettings((prev) => ({ ...DEFAULT_SETTINGS, ...parsed }));
      }
    } catch (_) {}
  }, []);

  const save = (next) => {
    setSettings((prev) => {
      const out = { ...prev, ...next };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
      } catch (_) {}
      return out;
    });
  };

  const updatePath = (index, value) => {
    setSettings((prev) => {
      const paths = [...(prev.crawledPaths || [])];
      while (paths.length <= index) paths.push('');
      paths[index] = value;
      const out = { ...prev, crawledPaths: paths.filter(Boolean).length ? paths : prev.crawledPaths };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
      } catch (_) {}
      return out;
    });
  };

  const inputClass = 'w-full px-3 py-2 rounded-lg border border-blaster-border bg-blaster-bg-card text-blaster-fg focus:ring-2 focus:ring-blaster-accent/40';

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-blaster-fg">Settings</h1>
        <p className="text-blaster-muted mt-0.5">Configure default values and limits</p>
      </div>

      <div className="space-y-6 max-w-2xl">
        <section className="bg-blaster-bg-card rounded-xl border border-blaster-border p-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🕐</span>
            <h2 className="font-semibold text-blaster-fg">Rate Limiting</h2>
          </div>
          <p className="text-sm text-blaster-muted mb-4">Control email sending speed</p>
          <label className="block text-sm font-medium text-blaster-fg mb-1">
            Default Delay Between Emails (seconds)
          </label>
          <input
            type="number"
            min={0.5}
            step={0.5}
            value={settings.delayBetweenEmails}
            onChange={(e) => save({ delayBetweenEmails: Number(e.target.value) || 1 })}
            className={inputClass}
          />
          <p className="text-xs text-blaster-muted mt-2">
            Minimum 0.5 seconds. Higher values reduce risk of being rate-limited by email providers.
          </p>
        </section>

        <section className="bg-blaster-bg-card rounded-xl border border-blaster-border p-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">📁</span>
            <h2 className="font-semibold text-blaster-fg">Crawler Settings</h2>
          </div>
          <p className="text-sm text-blaster-muted mb-4">Configure scanning behavior</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-blaster-fg mb-1">Max Concurrent Crawlers</label>
              <input
                type="number"
                min={1}
                max={20}
                value={settings.maxConcurrentCrawlers}
                onChange={(e) => save({ maxConcurrentCrawlers: Math.min(20, Math.max(1, Number(e.target.value) || 6)) })}
                className={inputClass}
              />
              <p className="text-xs text-blaster-muted mt-1">More crawlers = faster scans (1–20)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-blaster-fg mb-1">Max URLs Per Scan</label>
              <input
                type="number"
                min={1}
                max={5000}
                value={settings.maxUrlsPerScan}
                onChange={(e) => save({ maxUrlsPerScan: Math.min(5000, Math.max(1, Number(e.target.value) || 1000)) })}
                className={inputClass}
              />
              <p className="text-xs text-blaster-muted mt-1">Limit for safety. Maximum 5000 per scan.</p>
            </div>
          </div>
        </section>

        <section className="bg-blaster-bg-card rounded-xl border border-blaster-border p-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🌐</span>
            <h2 className="font-semibold text-blaster-fg">Crawled Pages</h2>
          </div>
          <p className="text-sm text-blaster-muted mb-4">The scanner checks these paths for each store</p>
          <div className="space-y-2">
            {(settings.crawledPaths || []).map((path, i) => (
              <input
                key={i}
                type="text"
                value={path}
                onChange={(e) => updatePath(i, e.target.value)}
                placeholder="/path"
                className={inputClass}
              />
            ))}
            <button
              type="button"
              onClick={() => updatePath((settings.crawledPaths || []).length, '')}
              className="text-sm text-blaster-accent hover:underline"
            >
              + Add path
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
