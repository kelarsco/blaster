import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Send,
  Users,
  Plus,
  Trash2,
  Eye,
  Code,
  Zap,
  CheckCircle,
  AlertCircle,
  Clock,
  ChevronRight,
} from 'react-feather';
import { useAdmin } from '../../context/AdminContext';
import { AdminMessage } from '../../components/AdminMessage';
import { ADMIN_PLAN_OPTIONS } from '../../data/adminPlanOptions.js';
import { AdminPageHeader, AdminButton, AdminPanel, AdminBadge, adminPanel, adminGhostBtn, adminHoverBg } from '../../components/admin';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'plan_asc', label: 'Plan A → Z' },
  { value: 'plan_desc', label: 'Plan Z → A' },
  { value: 'name_asc', label: 'Name A → Z' },
];

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

function StatusBadge({ status }) {
  const icons = {
    sending: <Clock className="w-3 h-3" />,
    sent: <CheckCircle className="w-3 h-3" />,
    failed: <AlertCircle className="w-3 h-3" />,
  };
  return (
    <AdminBadge variant={status || 'draft'} icon={icons[status]}>
      {status}
    </AdminBadge>
  );
}

export function AdminCampaignPage() {
  const { adminFetch } = useAdmin();
  const [searchParams, setSearchParams] = useSearchParams();
  const preselectedIds = useMemo(() => {
    const raw = searchParams.get('userIds');
    return raw ? raw.split(',').filter(Boolean) : [];
  }, [searchParams]);

  const [segments, setSegments] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [resendConfigured, setResendConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [htmlBody, setHtmlBody] = useState(
    `<div style="font-family: Inter, system-ui, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
  <div style="background: linear-gradient(135deg, #6366f1 0%, #f97316 100%); border-radius: 16px 16px 0 0; padding: 28px 24px;">
    <h1 style="margin: 0; color: #fff; font-size: 22px;">Hello from wiblaster</h1>
  </div>
  <div style="background: #fff; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 16px 16px; padding: 24px;">
    <p style="margin: 0 0 16px; line-height: 1.6;">Hi there,</p>
    <p style="margin: 0; line-height: 1.6;">Your message here…</p>
  </div>
  <p style="margin: 16px 0 0; font-size: 12px; color: #9ca3af; text-align: center;">— wiblaster</p>
</div>`
  );
  const [segmentId, setSegmentId] = useState('');
  const [manualUserIds, setManualUserIds] = useState([]);
  const [sendDelayMs, setSendDelayMs] = useState(600);
  const [previewCount, setPreviewCount] = useState(0);
  const [previewSample, setPreviewSample] = useState([]);
  const [previewTab, setPreviewTab] = useState('preview');
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [showNewSegment, setShowNewSegment] = useState(false);
  const [pollingId, setPollingId] = useState(null);
  const [opensCampaign, setOpensCampaign] = useState(null);

  useEffect(() => {
    if (preselectedIds.length) setManualUserIds(preselectedIds);
  }, [preselectedIds]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [segRes, campRes] = await Promise.all([
        adminFetch('/segments'),
        adminFetch('/campaigns'),
      ]);
      const segData = segRes.ok ? await segRes.json() : { segments: [] };
      const campData = campRes.ok ? await campRes.json() : { campaigns: [] };
      setSegments(segData.segments || []);
      setCampaigns(campData.campaigns || []);
      setResendConfigured(Boolean(campData.resendConfigured));
      if (!segmentId && !preselectedIds.length && segData.segments?.[0]) {
        setSegmentId(segData.segments[0].id);
      }
    } catch (_) {}
    setLoading(false);
  }, [adminFetch, preselectedIds.length]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const refreshPreview = useCallback(async () => {
    try {
      const body = manualUserIds.length
        ? { manualUserIds }
        : segmentId
          ? { segmentId }
          : null;
      if (!body) {
        setPreviewCount(0);
        setPreviewSample([]);
        return;
      }
      const res = await adminFetch('/segments/preview', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!res.ok) return;
      const data = await res.json();
      setPreviewCount(data.count ?? 0);
      setPreviewSample(data.sample || []);
    } catch (_) {}
  }, [adminFetch, segmentId, manualUserIds]);

  useEffect(() => {
    const t = setTimeout(refreshPreview, 300);
    return () => clearTimeout(t);
  }, [refreshPreview]);

  useEffect(() => {
    if (!pollingId) return undefined;
    const interval = setInterval(async () => {
      const res = await adminFetch(`/campaigns/${pollingId}`);
      if (!res.ok) return;
      const data = await res.json();
      const c = data.campaign;
      if (!c || c.status !== 'sending') {
        setPollingId(null);
        loadAll();
        if (c?.status === 'sent') {
          setMessage({ type: 'success', text: `Campaign sent to ${c.sentCount} recipient(s).` });
        } else if (c?.status === 'failed') {
          setMessage({ type: 'error', text: `Campaign finished with ${c.failedCount} failure(s).` });
        }
      } else {
        setCampaigns((prev) =>
          prev.map((x) => (x.id === c.id ? { ...x, ...c } : x))
        );
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [pollingId, adminFetch, loadAll]);

  const clearManualSelection = () => {
    setManualUserIds([]);
    setSearchParams({});
  };

  const handleSend = async () => {
    if (!subject.trim() || !htmlBody.trim()) {
      setMessage({ type: 'error', text: 'Subject and HTML body are required.' });
      return;
    }
    if (!segmentId && !manualUserIds.length) {
      setMessage({ type: 'error', text: 'Select a segment or users first.' });
      return;
    }
    if (previewCount === 0) {
      setMessage({ type: 'error', text: 'No recipients match this audience.' });
      return;
    }
    if (!resendConfigured) {
      setMessage({ type: 'error', text: 'Resend is not configured on the server (RESEND_API_KEY).' });
      return;
    }

    setSending(true);
    setMessage(null);
    try {
      const createRes = await adminFetch('/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim() || subject.trim(),
          subject: subject.trim(),
          htmlBody,
          segmentId: manualUserIds.length ? null : segmentId,
          manualUserIds: manualUserIds.length ? manualUserIds : [],
          sendDelayMs,
        }),
      });
      const created = await createRes.json().catch(() => ({}));
      if (!createRes.ok) throw new Error(created.error || 'Failed to create campaign');

      const campaignId = created.campaign?.id;
      const sendRes = await adminFetch(`/campaigns/${campaignId}/send`, { method: 'POST' });
      const sendData = await sendRes.json().catch(() => ({}));
      if (!sendRes.ok) throw new Error(sendData.error || 'Failed to start send');

      setMessage({
        type: 'success',
        text: `Sending to ${sendData.totalRecipients} user(s) — ~${Math.ceil((sendData.totalRecipients * sendDelayMs) / 1000 / 60)} min at ${sendDelayMs}ms between emails.`,
      });
      setPollingId(campaignId);
      setName('');
      setSubject('');
      clearManualSelection();
      loadAll();
    } catch (e) {
      setMessage({ type: 'error', text: e?.message || 'Send failed' });
    } finally {
      setSending(false);
    }
  };

  const estMinutes = previewCount > 0 ? Math.max(1, Math.ceil((previewCount * sendDelayMs) / 60000)) : 0;

  return (
    <div>
      <AdminPageHeader
        title="Campaign"
        subtitle="Segment your users and send one-time email campaigns via Resend."
        actions={
          <>
            <AdminButton to="/bl-admin/users" variant="ghost">
              <Users className="w-4 h-4" />
              Users
            </AdminButton>
            {!resendConfigured && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 text-amber-800 text-xs font-medium border border-amber-200">
                <AlertCircle className="w-3.5 h-3.5" />
                Resend not configured
              </span>
            )}
          </>
        }
      />

      <AdminMessage
        type={message?.type}
        message={message?.text}
        onDismiss={message ? () => setMessage(null) : undefined}
      />

      {manualUserIds.length > 0 && (
        <div className="mb-6 flex items-center justify-between gap-3 p-4 rounded-2xl border border-blaster-accent/30 bg-blaster-accent/5">
          <p className="text-sm text-blaster-fg">
            <strong>{manualUserIds.length}</strong> user(s) selected from Users page
          </p>
          <button
            type="button"
            onClick={clearManualSelection}
            className="text-sm text-blaster-muted hover:text-blaster-fg"
          >
            Clear selection
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mb-8">
        {/* Segments panel */}
        <section className={`xl:col-span-4 ${adminPanel} p-5`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-blaster-fg">Segments</h2>
            <button
              type="button"
              onClick={() => setShowNewSegment(true)}
              className="inline-flex items-center gap-1 text-xs font-medium text-blaster-accent hover:underline"
            >
              <Plus className="w-3.5 h-3.5" /> New
            </button>
          </div>
          {loading ? (
            <p className="text-sm text-blaster-muted">Loading…</p>
          ) : (
            <ul className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {segments.map((seg) => {
                const selected = !manualUserIds.length && segmentId === seg.id;
                return (
                  <li key={seg.id}>
                    <button
                      type="button"
                      onClick={() => {
                        clearManualSelection();
                        setSegmentId(seg.id);
                      }}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        selected
                          ? 'border-black bg-black/5 shadow-sm'
                          : `border-blaster-border hover:border-blaster-border ${adminHoverBg}`
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-blaster-fg truncate">{seg.name}</p>
                          {seg.description ? (
                            <p className="text-xs text-blaster-muted mt-0.5 line-clamp-2">{seg.description}</p>
                          ) : null}
                        </div>
                        {selected && <ChevronRight className="w-4 h-4 text-blaster-accent shrink-0 mt-0.5" />}
                      </div>
                      <p className="text-xs font-medium text-blaster-accent mt-2">
                        {seg.recipientCount ?? '—'} users
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {previewSample.length > 0 && (
            <div className="mt-4 pt-4 border-t border-blaster-border">
              <p className="text-xs font-medium text-blaster-muted mb-2">Sample recipients</p>
              <ul className="space-y-1">
                {previewSample.map((u) => (
                  <li key={u.id} className="text-xs text-blaster-fg truncate">
                    {u.name || u.email} · {u.planName}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Composer */}
        <section className="xl:col-span-8 space-y-4">
          <div className={`${adminPanel} p-5 space-y-4`}>
            <h2 className="text-sm font-semibold text-blaster-fg">Compose campaign</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-blaster-muted block mb-1.5">Campaign name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="March product update"
                  className="w-full px-3 py-2.5 rounded-xl border border-blaster-border text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-blaster-muted block mb-1.5">Email subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="What's new in wiblaster"
                  className="w-full px-3 py-2.5 rounded-xl border border-blaster-border text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setPreviewTab('html')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
                    previewTab === 'html' ? 'bg-black text-white' : 'bg-blaster-bg-app text-blaster-muted'
                  }`}
                >
                  <Code className="w-3.5 h-3.5" /> HTML
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('preview')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
                    previewTab === 'preview' ? 'bg-black text-white' : 'bg-blaster-bg-app text-blaster-muted'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" /> Preview
                </button>
              </div>
              {previewTab === 'html' ? (
                <textarea
                  value={htmlBody}
                  onChange={(e) => setHtmlBody(e.target.value)}
                  rows={14}
                  className="w-full px-3 py-2.5 rounded-xl border border-blaster-border text-sm font-mono leading-relaxed"
                  spellCheck={false}
                />
              ) : (
                <div className="rounded-xl border border-blaster-border bg-gray-50 overflow-hidden">
                  <iframe
                    title="Email preview"
                    srcDoc={htmlBody}
                    className="w-full h-[360px] bg-white"
                    sandbox=""
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-end gap-4 pt-2 border-t border-blaster-border">
              <div className="flex-1">
                <label className="text-xs font-medium text-blaster-muted block mb-1.5">
                  Send pacing (ms between emails)
                </label>
                <input
                  type="range"
                  min={400}
                  max={3000}
                  step={100}
                  value={sendDelayMs}
                  onChange={(e) => setSendDelayMs(Number(e.target.value))}
                  className="w-full"
                />
                <p className="text-xs text-blaster-muted mt-1">
                  {sendDelayMs}ms delay · ~{estMinutes} min for {previewCount} recipients
                </p>
              </div>
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !resendConfigured}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-black text-white text-sm font-semibold shadow-lg hover:opacity-90 disabled:opacity-50 shrink-0"
              >
                <Send className="w-4 h-4" />
                {sending ? 'Sending…' : `Send to ${previewCount || 0} users`}
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Campaign history */}
      <section className={`${adminPanel} p-5`}>
        <h2 className="text-sm font-semibold text-blaster-fg mb-1 flex items-center gap-2">
          <Zap className="w-4 h-4 text-blaster-orange" />
          Recent campaigns
        </h2>
        <p className="text-xs text-blaster-muted mb-4">
          A tracking pixel is added automatically when each campaign is sent so you can see who opened it.
        </p>
        {campaigns.length === 0 ? (
          <p className="text-sm text-blaster-muted">No campaigns yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-blaster-muted border-b border-blaster-border">
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Audience</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Sent</th>
                  <th className="pb-2 font-medium">Opened</th>
                  <th className="pb-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blaster-border">
                {campaigns.map((c) => {
                  const canReview = c.status === 'sent' || c.status === 'sending';
                  const unopened = Math.max(0, (c.sentCount ?? 0) - (c.openCount ?? 0));
                  return (
                  <tr
                    key={c.id}
                    className={canReview ? `cursor-pointer ${adminHoverBg} transition-colors` : undefined}
                    onClick={canReview ? () => setOpensCampaign(c) : undefined}
                  >
                    <td className="py-3 pr-4">
                      <p className="font-medium text-blaster-fg truncate max-w-[200px]">{c.name}</p>
                      <p className="text-xs text-blaster-muted truncate max-w-[200px]">{c.subject}</p>
                    </td>
                    <td className="py-3 pr-4 text-blaster-muted">{c.segmentName || '—'}</td>
                    <td className="py-3 pr-4"><StatusBadge status={c.status} /></td>
                    <td className="py-3 pr-4 text-blaster-muted">
                      {c.sentCount}/{c.totalRecipients}
                      {c.failedCount > 0 && (
                        <span className="text-red-600 ml-1">({c.failedCount} failed)</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-blaster-muted">
                      {c.sentCount > 0 ? (
                        <span>
                          <span className="text-emerald-700 font-medium">{c.openCount ?? 0}</span>
                          <span className="text-blaster-muted"> / {unopened} not yet</span>
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 text-blaster-muted whitespace-nowrap">{formatDate(c.createdAt)}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {opensCampaign && (
        <CampaignOpensModal
          campaign={opensCampaign}
          adminFetch={adminFetch}
          onClose={() => setOpensCampaign(null)}
        />
      )}

      {showNewSegment && (
        <NewSegmentModal
          onClose={() => setShowNewSegment(false)}
          onCreated={() => {
            setShowNewSegment(false);
            loadAll();
          }}
          adminFetch={adminFetch}
        />
      )}
    </div>
  );
}

function CampaignOpensModal({ campaign, adminFetch, onClose }) {
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [sends, setSends] = useState([]);
  const [stats, setStats] = useState({ sent: 0, opened: 0, unopened: 0, failed: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = filter ? `?filter=${encodeURIComponent(filter)}` : '';
      const res = await adminFetch(`/campaigns/${campaign.id}/sends${qs}`);
      if (res.ok) {
        const data = await res.json();
        setSends(data.sends || []);
        setStats(data.stats || { sent: 0, opened: 0, unopened: 0, failed: 0 });
      }
    } catch (_) {}
    setLoading(false);
  }, [adminFetch, campaign.id, filter]);

  useEffect(() => {
    load();
    const interval = setInterval(load, campaign.status === 'sending' ? 8000 : 30000);
    return () => clearInterval(interval);
  }, [load, campaign.status]);

  const tabs = [
    { id: '', label: 'All sent', count: stats.sent },
    { id: 'opened', label: 'Viewed', count: stats.opened },
    { id: 'unopened', label: 'Not viewed', count: stats.unopened },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-blaster-bg-card rounded-2xl border border-blaster-border shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-blaster-border flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-blaster-fg truncate">{campaign.name}</h2>
            <p className="text-sm text-blaster-muted mt-0.5 truncate">{campaign.subject}</p>
            <p className="text-xs text-blaster-muted mt-2">
              {stats.opened} viewed · {stats.unopened} not viewed · {stats.sent} delivered
            </p>
          </div>
          <button type="button" onClick={onClose} className={`p-2 rounded-full ${adminHoverBg} text-blaster-muted`} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="px-5 pt-3 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all ${
                filter === tab.id
                  ? 'bg-black text-white border-black'
                  : `border-blaster-border text-blaster-muted ${adminHoverBg}`
              }`}
            >
              {tab.label}
              <span className={filter === tab.id ? 'text-white/80' : 'text-blaster-muted'}>{tab.count}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 pt-3">
          {loading && sends.length === 0 ? (
            <p className="text-sm text-blaster-muted">Loading recipients…</p>
          ) : sends.length === 0 ? (
            <p className="text-sm text-blaster-muted">No recipients in this view.</p>
          ) : (
            <ul className="space-y-2">
              {sends.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl border border-blaster-border bg-blaster-bg-app"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-blaster-fg truncate">{s.userName || s.email}</p>
                    <p className="text-xs text-blaster-muted truncate">{s.email}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {s.openedAt ? (
                      <AdminBadge variant="sent">Viewed</AdminBadge>
                    ) : (
                      <AdminBadge variant="draft">Not viewed</AdminBadge>
                    )}
                    <p className="text-[11px] text-blaster-muted mt-1">
                      {s.openedAt ? formatDate(s.openedAt) : formatDate(s.sentAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function NewSegmentModal({ onClose, onCreated, adminFetch }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [joinedWithinDays, setJoinedWithinDays] = useState('');
  const [joinedOlderThanDays, setJoinedOlderThanDays] = useState('');
  const [planIds, setPlanIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const togglePlan = (id) => {
    setPlanIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const filter = {
        excludeDeactivated: true,
        excludeSuspended: true,
      };
      if (joinedWithinDays) filter.joinedWithinDays = Number(joinedWithinDays);
      if (joinedOlderThanDays) filter.joinedOlderThanDays = Number(joinedOlderThanDays);
      if (planIds.length) filter.planIds = planIds;

      const res = await adminFetch('/segments', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), description: description.trim(), filter }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed');
      onCreated(data.segment);
    } catch (err) {
      setError(err.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl border border-blaster-border shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-blaster-fg mb-4">New segment</h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-blaster-muted block mb-1">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-blaster-border text-sm"
              placeholder="Users joined last 14 days"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-blaster-muted block mb-1">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-blaster-border text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-blaster-muted block mb-1">Joined within (days)</label>
              <input
                type="number"
                min={1}
                value={joinedWithinDays}
                onChange={(e) => setJoinedWithinDays(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-blaster-border text-sm"
                placeholder="7"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-blaster-muted block mb-1">Joined more than (days)</label>
              <input
                type="number"
                min={0}
                value={joinedOlderThanDays}
                onChange={(e) => setJoinedOlderThanDays(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-blaster-border text-sm"
                placeholder="30"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-blaster-muted block mb-2">Filter by plan (optional)</label>
            <div className="flex flex-wrap gap-2">
              {ADMIN_PLAN_OPTIONS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePlan(p.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs border ${
                    planIds.includes(p.id)
                      ? 'border-blaster-accent bg-blaster-accent/10 text-blaster-accent'
                      : 'border-blaster-border text-blaster-muted'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-black text-white text-sm font-medium disabled:opacity-50">
              {saving ? 'Creating…' : 'Create segment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
