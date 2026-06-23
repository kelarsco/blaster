import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Play } from 'react-feather';
import { getYoutubeThumbnailUrl, getYoutubeVideoId } from '../../utils/youtube.js';

export function PriorityResourceToast({ video, onDismiss }) {
  const navigate = useNavigate();
  if (!video) return null;

  const videoId = getYoutubeVideoId(video.url);
  const thumb = getYoutubeThumbnailUrl(videoId);

  const goToResources = () => {
    onDismiss?.(video.id);
    navigate('/app/resources');
  };

  return (
    <div
      className="fixed z-[1200] bottom-4 right-4 sm:bottom-6 sm:right-6 w-[min(100vw-2rem,22rem)] transition-all duration-300 ease-out"
      role="dialog"
      aria-label="Important new video"
    >
      <div className="relative overflow-hidden rounded-2xl border border-white/30 shadow-[0_20px_50px_rgba(99,102,241,0.25)] backdrop-blur-xl bg-gradient-to-br from-blaster-accent/20 via-white/80 to-blaster-orange/25">
        <div className="absolute inset-0 bg-brand-gradient-soft opacity-40 pointer-events-none" />
        <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-blaster-purple/20 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-28 h-28 rounded-full bg-blaster-orange/25 blur-2xl pointer-events-none" />

        <button
          type="button"
          onClick={() => onDismiss?.(video.id)}
          className="absolute top-2.5 right-2.5 z-10 flex items-center justify-center w-8 h-8 rounded-full bg-black/40 text-white hover:bg-black/55 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" strokeWidth={2} />
        </button>

        <button
          type="button"
          onClick={goToResources}
          className="relative w-full text-left p-3 sm:p-4 group"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-gradient mb-2 pr-8">
            Important resource
          </p>
          <div className="relative aspect-video rounded-xl overflow-hidden border border-white/40 shadow-md mb-3">
            {thumb ? (
              <img src={thumb} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blaster-accent/30 to-blaster-orange/40" />
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
              <span className="flex items-center justify-center w-12 h-12 rounded-full bg-white/90 text-blaster-accent shadow-lg">
                <Play className="w-5 h-5 ml-0.5" fill="currentColor" strokeWidth={0} />
              </span>
            </div>
          </div>
          <p className="text-sm font-semibold text-blaster-fg leading-snug line-clamp-2 group-hover:underline decoration-blaster-accent/50 underline-offset-2">
            {video.title}
          </p>
          <p className="text-xs text-blaster-muted mt-1">Tap to watch in Resources</p>
        </button>
      </div>
    </div>
  );
}
