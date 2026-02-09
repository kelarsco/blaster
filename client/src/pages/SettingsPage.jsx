import React, { useState, useEffect } from 'react';
import { Clock, Folder, Globe } from 'react-feather';

const STORAGE_KEY = 'blaster-settings';

const DEFAULT_SETTINGS = {
  delayBetweenEmails: 10,
  maxConcurrentCrawlers: 2,
  maxUrlsPerScan: 1000,
  // Keep in sync with PATHS_TO_TRY in server/services/crawler.js
  crawledPaths: [
    '/policies/privacy-policy',
    '/policies/contact-information',
    '/pages/contact',
    '/pages/contact-us',
    '/pages/about-us',
    '/pages/about',
    '/contact',
    '/contact-us',
    '/about',
    '/about-us',
    '/help',
    '/support',
    '/impressum',
    '/legal',
    '/',
  ],
};

export function SettingsPage() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [isDirty, setIsDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setSettings((prev) => ({ ...DEFAULT_SETTINGS, ...parsed }));
      }
    } catch (_) {}
  }, []);

  const applyChange = (next) => {
    setSettings((prev) => ({ ...prev, ...next }));
    setIsDirty(true);
  };

  const updatePath = (index, value) => {
    setSettings((prev) => {
      const paths = [...(prev.crawledPaths || [])];
      while (paths.length <= index) paths.push('');
      paths[index] = value;
      return { ...prev, crawledPaths: paths.filter(Boolean).length ? paths : prev.crawledPaths };
    });
    setIsDirty(true);
  };

  const persistSettings = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      setIsDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (_) {}
  };

  const inputClass = 'w-full px-3 py-2 rounded-lg border border-blaster-border bg-blaster-bg-card text-blaster-fg focus:ring-2 focus:ring-blaster-accent/40';

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-6 md:mb-8">
        <h1 className="page-title-mobile">Settings</h1>
        <p className="text-xs md:text-sm text-blaster-muted mt-0.5">Configure default values and limits</p>
      </div>

      <div className="space-y-4 md:space-y-6 max-w-2xl">
        <section className="bg-blaster-bg-card rounded-xl border border-blaster-border card-body-mobile">
          <div className="flex items-center gap-2 mb-1.5 md:mb-2">
            <Clock className="w-4 h-4 md:w-5 md:h-5 text-blaster-muted" strokeWidth={2} />
            <h2 className="card-title-mobile">Rate Limiting</h2>
          </div>
          <p className="text-xs md:text-sm text-blaster-muted mb-3 md:mb-4">Control email sending speed</p>
          <label className="block text-sm font-medium text-blaster-fg mb-1">
            Default Delay Between Emails (seconds)
          </label>
          <input
            type="number"
            min={20}
            max={300}
            step={1}
            value={settings.delayBetweenEmails}
            onChange={(e) => applyChange({ delayBetweenEmails: Math.max(20, Number(e.target.value) || 20) })}
            className={inputClass}
          />
          <p className="text-xs text-blaster-muted mt-2">
            Minimum 10 seconds (enforced). You can increase for a slower, more conservative pace.
          </p>
        </section>

        <section className="bg-blaster-bg-card rounded-xl border border-blaster-border card-body-mobile">
          <div className="flex items-center gap-2 mb-1.5 md:mb-2">
            <Folder className="w-4 h-4 md:w-5 md:h-5 text-blaster-muted" strokeWidth={2} />
            <h2 className="card-title-mobile">Crawler Settings</h2>
          </div>
          <p className="text-xs md:text-sm text-blaster-muted mb-3 md:mb-4">Configure scanning behavior</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-blaster-fg mb-1">Max Concurrent Crawlers</label>
              <input
                type="number"
                min={1}
                max={20}
                value={settings.maxConcurrentCrawlers}
                onChange={(e) => applyChange({ maxConcurrentCrawlers: Math.min(20, Math.max(1, Number(e.target.value) || 6)) })}
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
                onChange={(e) => applyChange({ maxUrlsPerScan: Math.min(5000, Math.max(1, Number(e.target.value) || 1000)) })}
                className={inputClass}
              />
              <p className="text-xs text-blaster-muted mt-1">Limit for safety. Maximum 5000 per scan.</p>
            </div>
          </div>
        </section>

        <section className="bg-blaster-bg-card rounded-xl border border-blaster-border card-body-mobile">
          <div className="flex items-center gap-2 mb-1.5 md:mb-2">
            <Globe className="w-4 h-4 md:w-5 md:h-5 text-blaster-muted" strokeWidth={2} />
            <h2 className="card-title-mobile">Crawled Pages</h2>
          </div>
          <p className="text-xs md:text-sm text-blaster-muted mb-3 md:mb-4">The scanner checks these paths for each store</p>
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

        {isDirty && (
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={persistSettings}
              className="btn-blaster-accent text-sm"
            >
              {saved ? 'Saved' : 'Update'}
            </button>
            <span className="text-sm text-blaster-muted">
              {saved ? 'Scan settings updated. New scans will use these values.' : 'You have unsaved changes.'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
