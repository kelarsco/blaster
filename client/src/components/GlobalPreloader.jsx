import React, { useState, useEffect, useRef } from 'react';

const SHOW_MS = 500;
const FADE_MS = 300;

/**
 * Simple full-screen circle loading preloader that fades out after a short delay.
 * Used on all pages except the dashboard (/app/*) which keeps its own preloader.
 */
export function GlobalPreloader({ visible, onFadeComplete }) {
  const [fading, setFading] = useState(false);
  const onCompleteRef = useRef(onFadeComplete);

  onCompleteRef.current = onFadeComplete;

  useEffect(() => {
    if (!visible) return;
    setFading(false);
    const startFade = setTimeout(() => setFading(true), SHOW_MS);
    const finish = setTimeout(() => {
      onCompleteRef.current?.();
    }, SHOW_MS + FADE_MS);
    return () => {
      clearTimeout(startFade);
      clearTimeout(finish);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-blaster-bg-app transition-opacity duration-300 ease-out"
      style={{
        opacity: fading ? 0 : 1,
        transitionDuration: `${FADE_MS}ms`,
      }}
      aria-hidden="true"
    >
      <div
        className="w-12 h-12 rounded-full border-2 border-blaster-border border-t-blaster-accent animate-spin"
        role="presentation"
      />
    </div>
  );
}
