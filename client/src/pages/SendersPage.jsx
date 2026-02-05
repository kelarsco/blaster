import React, { useState, useEffect } from 'react';
import { API } from '../api.js';

export function SendersPage() {
  const [senders, setSenders] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newSender, setNewSender] = useState({
    email: '',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    user: '',
    pass: '',
    maxPerMinute: 10,
  });
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API}/automation/senders`)
      .then((r) => r.json())
      .then((d) => setSenders(d.senders || []));
  }, []);

  const addSender = async () => {
    if (!newSender.email) return;
    setError('');
    try {
      const res = await fetch(`${API}/automation/senders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newSender.email,
          config: {
            host: newSender.host,
            port: Number(newSender.port),
            secure: newSender.secure,
            auth: { user: newSender.user, pass: newSender.pass },
          },
          maxPerMinute: Number(newSender.maxPerMinute) || 10,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setSenders((prev) => [...prev, { id: data.id, email: data.email, maxPerMinute: data.maxPerMinute }]);
      setNewSender({ email: '', host: 'smtp.gmail.com', port: 587, secure: false, user: '', pass: '', maxPerMinute: 10 });
      setShowAdd(false);
    } catch (e) {
      setError(e.message);
    }
  };

  const removeSender = async (senderId) => {
    try {
      const res = await fetch(`${API}/automation/senders/${senderId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to remove');
      setSenders((prev) => prev.filter((s) => s.id !== senderId));
    } catch (e) {
      setError(e.message);
    }
  };

  const inputClass = 'w-full px-3 py-2 rounded-lg border border-blaster-border bg-blaster-bg-card text-blaster-fg placeholder-blaster-muted focus:ring-2 focus:ring-blaster-accent/40 focus:border-blaster-accent';

  return (
    <div className="p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-blaster-fg">Senders</h1>
          <p className="text-blaster-muted mt-0.5">Manage email accounts used for campaigns</p>
        </div>
        <button
          type="button"
          onClick={() => { setShowAdd(true); setError(''); }}
          className="btn-blaster-accent shrink-0"
        >
          + Add Sender
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="bg-blaster-bg-card rounded-xl border border-blaster-border overflow-hidden">
        {senders.length === 0 && !showAdd ? (
          <div className="p-12 text-center text-blaster-muted">
            <p>No senders yet. Add one to run campaigns.</p>
          </div>
        ) : (
          <ul className="divide-y divide-blaster-border">
            {senders.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <span className="font-medium text-blaster-fg">{s.email}</span>
                  <span className="ml-2 text-sm text-blaster-muted">(max {s.maxPerMinute}/min)</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeSender(s.id)}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        {showAdd && (
          <div className="p-6 border-t border-blaster-border space-y-4">
            <h3 className="font-semibold text-blaster-fg">New sender</h3>
            <input
              type="email"
              placeholder="Sender email"
              value={newSender.email}
              onChange={(e) => setNewSender((prev) => ({ ...prev, email: e.target.value }))}
              className={inputClass}
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="SMTP host"
                value={newSender.host}
                onChange={(e) => setNewSender((prev) => ({ ...prev, host: e.target.value }))}
                className={inputClass}
              />
              <input
                type="number"
                placeholder="Port"
                value={newSender.port}
                onChange={(e) => setNewSender((prev) => ({ ...prev, port: e.target.value }))}
                className={inputClass}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-blaster-fg">
              <input
                type="checkbox"
                checked={newSender.secure}
                onChange={(e) => setNewSender((prev) => ({ ...prev, secure: e.target.checked }))}
                className="rounded border-blaster-border"
              />
              TLS/SSL
            </label>
            <input
              type="text"
              placeholder="SMTP user"
              value={newSender.user}
              onChange={(e) => setNewSender((prev) => ({ ...prev, user: e.target.value }))}
              className={inputClass}
            />
            <input
              type="password"
              placeholder="SMTP password / app password"
              value={newSender.pass}
              onChange={(e) => setNewSender((prev) => ({ ...prev, pass: e.target.value }))}
              className={inputClass}
            />
            <input
              type="number"
              min={1}
              max={60}
              placeholder="Max per minute"
              value={newSender.maxPerMinute}
              onChange={(e) => setNewSender((prev) => ({ ...prev, maxPerMinute: e.target.value }))}
              className={inputClass}
            />
            <div className="flex gap-2">
              <button type="button" onClick={addSender} className="btn-blaster-accent">
                Save sender
              </button>
              <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg border border-blaster-border text-blaster-fg hover:bg-blaster-sidebar-hover">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
