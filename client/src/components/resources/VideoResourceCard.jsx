import React, { useState } from 'react';
import { Play } from 'react-feather';
import {
  getYoutubeEmbedUrl,
  getYoutubeThumbnailUrl,
  getYoutubeVideoId,
} from '../../utils/youtube.js';

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

export function VideoResourceCard({ resource }) {
  const [playing, setPlaying] = useState(false);
  const videoId = getYoutubeVideoId(resource.url);
  const thumb = getYoutubeThumbnailUrl(videoId);
  const embedUrl = getYoutubeEmbedUrl(videoId, { autoplay: true });

  return (
    <article className="flex flex-col">
      <div
        className="relative rounded-xl border border-blaster-border bg-blaster-bg-app overflow-hidden min-h-[100px] aspect-video"
      >
        {playing && embedUrl ? (
          <iframe
            title={resource.title}
            src={embedUrl}
            className="absolute inset-0 w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : (
          <>
            {thumb ? (
              <img
                src={thumb}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-blaster-accent/10 to-blaster-orange/15" />
            )}
            <button
              type="button"
              onClick={() => videoId && setPlaying(true)}
              disabled={!videoId}
              className="absolute inset-0 flex items-center justify-center bg-black/10 hover:bg-black/20 transition disabled:cursor-not-allowed"
              aria-label={`Play ${resource.title}`}
            >
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-blaster-accent to-blaster-orange shadow-md"
              >
                <Play className="w-5 h-5 text-black" strokeWidth={2} aria-hidden />
              </span>
            </button>
          </>
        )}
      </div>
      <h3 className="mt-3 text-sm font-semibold text-blaster-fg line-clamp-2">{resource.title}</h3>
      <p className="text-xs text-blaster-muted mt-1">{formatAddedAt(resource.createdAt)}</p>
    </article>
  );
}
