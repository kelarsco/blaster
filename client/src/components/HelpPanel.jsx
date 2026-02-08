import React, { useState, useMemo } from 'react';
import { HELP_TOPICS, HELP_SECTIONS_ORDER } from './helpTopics.js';

function SearchIcon() {
  return (
    <svg className="w-5 h-5 text-blaster-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export function HelpPanel({ onClose }) {
  const [search, setSearch] = useState('');
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [loading, setLoading] = useState(false);

  const filteredTopics = useMemo(() => {
    if (!search.trim()) return HELP_TOPICS;
    const q = search.toLowerCase();
    return HELP_TOPICS.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.section && t.section.toLowerCase().includes(q)) ||
        (t.content && t.content.toLowerCase().includes(q))
    );
  }, [search]);

  const topicsBySection = useMemo(() => {
    const map = new Map();
    for (const topic of filteredTopics) {
      const section = topic.section || 'Other';
      if (!map.has(section)) map.set(section, []);
      map.get(section).push(topic);
    }
    const result = [];
    for (const section of HELP_SECTIONS_ORDER) {
      if (map.has(section)) result.push({ section, topics: map.get(section) });
    }
    const seen = new Set(HELP_SECTIONS_ORDER);
    for (const [section] of map) {
      if (!seen.has(section)) result.push({ section, topics: map.get(section) });
    }
    return result;
  }, [filteredTopics]);

  const handleTopicClick = (topic) => {
    setLoading(true);
    setSelectedTopic(topic);
    // Preload: simulate brief fetch before showing content
    setTimeout(() => setLoading(false), 600);
  };

  const handleBack = () => {
    setSelectedTopic(null);
    setLoading(false);
  };

  const formatContent = (text) => {
    return text.split('\n\n').map((para, i) => {
      const trimmed = para.trim();
      if (!trimmed) return null;
      if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
        return <p key={i} className="font-semibold text-blaster-fg mt-4 mb-1 first:mt-0">{trimmed.slice(2, -2)}</p>;
      }
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const items = trimmed.split('\n').filter(Boolean);
        return (
          <ul key={i} className="list-disc list-inside mt-2 space-y-1 text-blaster-muted">
            {items.map((item, j) => (
              <li key={j}>{item.replace(/^[-*]\s*/, '')}</li>
            ))}
          </ul>
        );
      }
      if (/^\d+\.\s/.test(trimmed)) {
        const items = trimmed.split(/\n(?=\d+\.\s)/).filter(Boolean);
        return (
          <ol key={i} className="list-decimal list-inside mt-2 space-y-1.5 text-blaster-muted">
            {items.map((item, j) => (
              <li key={j}>{item.replace(/^\d+\.\s*/, '')}</li>
            ))}
          </ol>
        );
      }
      return <p key={i} className="text-blaster-muted leading-relaxed">{trimmed}</p>;
    }).filter(Boolean);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      {/* Panel */}
      <div
        className="relative w-full max-w-lg bg-white border-l border-blaster-border shadow-2xl flex flex-col animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between gap-4 px-6 py-4 border-b border-blaster-border">
          <div className="w-16 flex justify-start">
            {selectedTopic && (
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-2 text-blaster-fg hover:text-blaster-muted font-medium text-sm"
              >
                <BackIcon />
                Back
              </button>
            )}
          </div>
          <h2 className="flex-1 text-center text-lg font-bold text-blaster-fg">Help & Support</h2>
          <div className="w-16 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-blaster-muted hover:text-blaster-fg hover:bg-gray-100 transition"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
          </div>
        </div>

        {/* Search */}
        <div className="shrink-0 px-4 py-3 border-b border-blaster-border">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-blaster-border bg-blaster-bg-app">
            <SearchIcon />
            <input
              type="text"
              placeholder="Search help center"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-blaster-fg placeholder-blaster-muted text-sm outline-none focus:ring-0"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-10 h-10 border-2 border-blaster-fg border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-sm text-blaster-muted">Loading...</p>
            </div>
          ) : selectedTopic ? (
            <article>
              <h1 className="text-xl font-bold text-blaster-fg">{selectedTopic.title}</h1>
              <p className="text-sm text-blaster-muted mt-1">by wiblaster</p>
              <div className="mt-6 space-y-3 text-sm">
                {formatContent(selectedTopic.content)}
              </div>
            </article>
          ) : (
            <>
              <p className="text-sm text-blaster-muted mb-4">
                {search.trim() ? 'Search results' : 'Browse by topic'}
              </p>
              <div className="space-y-6">
                {topicsBySection.map(({ section, topics }) => (
                  <div key={section}>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-blaster-muted mb-2">
                      {section}
                    </h3>
                    <ul className="space-y-3">
                      {topics.map((topic) => (
                        <li key={topic.id}>
                          <button
                            type="button"
                            onClick={() => handleTopicClick(topic)}
                            className="text-left w-full group"
                          >
                            <span className="text-base font-medium text-blaster-fg group-hover:text-blaster-muted transition block">
                              {topic.title}
                            </span>
                            {topic.description && (
                              <span className="text-sm text-blaster-fg mt-1 line-clamp-2 block">
                                {topic.description}
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              {filteredTopics.length === 0 && (
                <p className="text-sm text-blaster-muted py-8">No articles match your search.</p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 p-4 border-t border-blaster-border">
          <button
            type="button"
            onClick={() => window.location.href = 'mailto:support@wiblaster.com'}
            className="w-full py-2.5 rounded-lg border-2 border-[#1a1a21] text-blaster-fg font-medium text-sm hover:bg-gray-100 transition"
          >
            Contact Us
          </button>
        </div>
      </div>
    </div>
  );
}
