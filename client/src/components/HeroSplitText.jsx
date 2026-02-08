import React, { useMemo } from 'react';

/**
 * Splits text into words and animates each word with a staggered delay (React Bits–style split text).
 */
export function HeroSplitText({ text, className = '', delayMs = 60 }) {
  const words = useMemo(() => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(\s+)/);
  }, [text]);

  return (
    <span className={className}>
      {words.map((part, i) => {
        const isSpace = /^\s+$/.test(part);
        if (isSpace) return <span key={i}>{part}</span>;
        return (
          <span
            key={i}
            className="landing-split-word"
            style={{ animationDelay: `${i * delayMs}ms` }}
          >
            {part}
          </span>
        );
      })}
    </span>
  );
}
