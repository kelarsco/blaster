import React from 'react';
import { FileText } from 'react-feather';

function formatAddedAt(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function DocumentResourceCard({ resource }) {
  const openDocument = () => {
    if (resource.url) window.open(resource.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <article className="flex flex-col">
      <button
        type="button"
        onClick={openDocument}
        className="relative rounded-xl border border-blaster-border bg-white overflow-hidden min-h-[100px] aspect-video flex items-center justify-center hover:border-blaster-accent/30 hover:bg-blaster-bg-app transition group text-left w-full"
      >
        <div
          className="flex flex-col items-center justify-center gap-2 px-4"
        >
          <span
            className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-blaster-accent/15 to-blaster-orange/25 border border-blaster-accent/20 group-hover:from-blaster-accent/25 group-hover:to-blaster-orange/35 transition"
          >
            <FileText className="w-5 h-5 text-blaster-fg" strokeWidth={1.75} aria-hidden />
          </span>
          <span className="text-xs font-medium text-blaster-muted group-hover:text-blaster-fg transition">
            Open PDF
          </span>
        </div>
      </button>
      <h3 className="mt-3 text-sm font-semibold text-blaster-fg line-clamp-2">{resource.title}</h3>
      <p className="text-xs text-blaster-muted mt-1">{formatAddedAt(resource.createdAt)}</p>
    </article>
  );
}
