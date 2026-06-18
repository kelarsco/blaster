import React from 'react';
import {
  formatTrialCountdownLabel,
  trialCountdownAriaLabel,
} from '../../utils/trialCountdown.js';

export function TrialCountdown({ ms, trialEndsAt, className = '', size = 'default' }) {
  if (ms <= 0) return null;

  const dateTime = trialEndsAt || undefined;

  return (
    <time
      dateTime={dateTime}
      className={`trial-countdown trial-countdown--${size} ${className}`.trim()}
      aria-label={trialCountdownAriaLabel(ms)}
    >
      {formatTrialCountdownLabel(ms)}
    </time>
  );
}
