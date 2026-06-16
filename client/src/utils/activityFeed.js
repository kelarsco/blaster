import {
  Check,
  Mail,
  Plus,
  Minus,
  Search,
  Download,
  Users,
  Globe,
  Send,
  Trash2,
  Settings,
  FileText,
  Zap,
} from 'react-feather';

const ACTIVITY_META = {
  scan_completed: {
    icon: Check,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    title: 'Scan completed',
  },
  scan_running: {
    icon: Search,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    title: 'Scan in progress',
  },
  scan_pending: {
    icon: Search,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    title: 'Scan started',
  },
  scan_failed: {
    icon: Minus,
    iconVariant: 'dash',
    iconBg: 'bg-red-50',
    iconColor: 'text-red-600',
    title: 'Scan failed',
  },
  campaign_start: {
    icon: Send,
    iconBg: 'bg-indigo-50',
    iconColor: 'text-blaster-accent',
    title: 'Campaign started',
  },
  domain_email_campaign_start: {
    icon: Mail,
    iconBg: 'bg-indigo-50',
    iconColor: 'text-blaster-accent',
    title: 'Campaign emails sent',
  },
  sender_add: {
    icon: Plus,
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-600',
    title: 'Sender added',
  },
  sender_remove: {
    icon: Trash2,
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-600',
    title: 'Sender removed',
  },
  sender_group_add: {
    icon: Users,
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-600',
    title: 'Sender group created',
  },
  sender_group_remove: {
    icon: Users,
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-600',
    title: 'Sender group removed',
  },
  preset_save: {
    icon: FileText,
    iconBg: 'bg-sky-50',
    iconColor: 'text-sky-600',
    title: 'Campaign preset saved',
  },
  export_excel: {
    icon: Download,
    iconBg: 'bg-teal-50',
    iconColor: 'text-teal-600',
    title: 'Export downloaded',
  },
  domain_email_domain_added: {
    icon: Globe,
    iconBg: 'bg-indigo-50',
    iconColor: 'text-blaster-accent',
    title: 'Domain added',
  },
  domain_email_domain_verify: {
    icon: Check,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    title: 'Domain verified',
  },
  domain_email_domain_sync: {
    icon: Zap,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    title: 'Domain synced',
  },
  domain_email_sender_added: {
    icon: Plus,
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-600',
    title: 'Domain sender added',
  },
  domain_email_inbound_reply: {
    icon: Mail,
    iconBg: 'bg-indigo-50',
    iconColor: 'text-blaster-accent',
    title: 'Inbound reply received',
  },
};

const DEFAULT_META = {
  icon: Settings,
  iconBg: 'bg-gray-100',
  iconColor: 'text-gray-600',
  title: 'Activity',
};

export function getActivityMeta(activityType) {
  return ACTIVITY_META[activityType] || DEFAULT_META;
}

function detailFromLog(type, payload = {}) {
  switch (type) {
    case 'campaign_start':
      return payload.totalQueued ? `${payload.totalQueued} emails queued` : null;
    case 'domain_email_campaign_start':
      if (payload.sent != null) return `${payload.sent} sent · ${payload.failed || 0} failed`;
      return payload.totalQueued ? `${payload.totalQueued} emails queued` : null;
    case 'sender_add':
    case 'domain_email_sender_added':
      return payload.email || payload.fromEmail || null;
    case 'sender_group_add':
    case 'sender_group_remove':
      return payload.name || null;
    case 'preset_save':
      return payload.name || null;
    case 'export_excel':
      return payload.scanId ? `Scan ${String(payload.scanId).slice(0, 8)}` : null;
    case 'domain_email_domain_added':
    case 'domain_email_domain_verify':
    case 'domain_email_domain_sync':
      return payload.domain || null;
    case 'domain_email_inbound_reply':
      return payload.threadId ? `Thread ${String(payload.threadId).slice(0, 8)}` : null;
    default:
      if (payload.scanId) return `Scan ${String(payload.scanId).slice(0, 8)}`;
      return null;
  }
}

function scanActivityType(status) {
  if (status === 'completed') return 'scan_completed';
  if (status === 'failed') return 'scan_failed';
  if (status === 'running' || status === 'processing') return 'scan_running';
  return 'scan_pending';
}

export function buildActivityFeedItem({ id, activityType, title, detail, createdAt }) {
  const meta = getActivityMeta(activityType);
  return {
    id,
    activityType,
    title: title || meta.title,
    detail,
    createdAt,
    icon: meta.icon,
    iconVariant: meta.iconVariant,
    iconBg: meta.iconBg,
    iconColor: meta.iconColor,
  };
}

export function buildRecentActivityFeed({ scans = [], activityLogs = [] }) {
  const scanEvents = scans.map((s) => {
    const activityType = scanActivityType(s.status);
    const meta = getActivityMeta(activityType);
    return buildActivityFeedItem({
      id: `scan-${s.id}`,
      activityType,
      title: meta.title,
      detail: `${s.foundCount || 0} emails from ${s.processed || 0} stores`,
      createdAt: s.createdAt,
    });
  });

  const logEvents = activityLogs.map((l) => {
    const type = l.type || 'activity';
    const meta = getActivityMeta(type);
    return buildActivityFeedItem({
      id: `log-${l.id}`,
      activityType: type,
      title: meta.title,
      detail: detailFromLog(type, l.payload),
      createdAt: l.createdAt,
    });
  });

  return [...logEvents, ...scanEvents]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 50);
}

export function formatActivityTimeLeft(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export function normalizeActivityEntry(entry) {
  if (!entry) return null;
  if (entry.icon && entry.title) return entry;

  const activityType =
    entry.activityType ||
    (entry.label?.toLowerCase().includes('scan completed') ? 'scan_completed' : entry.type) ||
    'activity';

  const meta = getActivityMeta(activityType);
  return buildActivityFeedItem({
    id: entry.id || `activity-${entry.createdAt}`,
    activityType,
    title: entry.title || entry.label || meta.title,
    detail: entry.detail || null,
    createdAt: entry.createdAt,
  });
}
