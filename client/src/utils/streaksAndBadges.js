/** Badge display definitions — unlock state comes from the server. */
export const BADGE_DEFS = [
  { id: 'streak-3', label: '3-Day Streak', icon: 'fire', type: 'streak', threshold: 3 },
  { id: 'streak-7', label: '7-Day Streak', icon: 'zap', type: 'streak', threshold: 7 },
  { id: 'streak-14', label: '14-Day Streak', icon: 'wallet', type: 'streak', threshold: 14 },
  { id: 'streak-30', label: '30-Day Streak', icon: 'trophy', type: 'streak', threshold: 30 },
  { id: 'emails-500', label: '500 Emails', icon: 'target', type: 'emails', threshold: 500 },
  { id: 'emails-1000', label: '1,000 Emails', icon: 'medal', type: 'emails', threshold: 1000 },
  { id: 'emails-5000', label: '5,000 Emails', icon: 'rocket', type: 'emails', threshold: 5000 },
  { id: 'emails-10000', label: '10,000 Emails', icon: 'star', type: 'emails', threshold: 10000 },
  { id: 'emails-30000', label: '30,000 Emails', icon: 'crown', type: 'emails', threshold: 30000 },
  { id: 'emails-50000', label: '50,000 Emails', icon: 'ribbon', type: 'emails', threshold: 50000 },
];

export const MIN_DAILY_TARGET = 100;

export function defaultStreaksState() {
  return {
    dailyTarget: null,
    hasDailyTarget: false,
    currentStreak: 0,
    highestStreakBadgeEarned: 0,
    totalEmailsSent: 0,
    emailsSentToday: 0,
    streakLabel: 'Set your daily target',
    thisWeekEmails: 0,
    allTimeEmails: 0,
    badges: BADGE_DEFS.map((b) => ({ ...b, unlocked: false })),
  };
}
