import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '../../context/AdminContext';
import { API } from '../../api.js';

export function AdminLoginPage() {
  const navigate = useNavigate();
  const { refetchAdmin } = useAdmin();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from your authenticator app');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/bl-admin/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Invalid code');
      const sessionOk = await refetchAdmin();
      if (!sessionOk) {
        throw new Error(
          'Code accepted but session could not be saved. Clear site cookies for wiblaster.com and try again.'
        );
      }
      navigate('/bl-admin/overview', { replace: true });
    } catch (err) {
      setError(err?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-blaster-bg-app p-4">
      <div className="w-full max-w-sm rounded-2xl border border-blaster-border bg-blaster-bg-card p-8 shadow-lg">
        <h1 className="text-xl font-bold text-blaster-fg text-center">Admin login</h1>
        <p className="text-sm text-blaster-muted text-center mt-1">
          Enter the 6-digit code from your Google Authenticator app
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className="w-full px-4 py-3 rounded-xl border border-blaster-border bg-blaster-input-bg text-blaster-fg text-center text-2xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-blaster-accent/40"
            autoFocus
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full py-2.5 rounded-xl bg-blaster-fg text-white font-semibold disabled:opacity-50"
          >
            {loading ? 'Verifying…' : 'Log in'}
          </button>
        </form>
      </div>
    </div>
  );
}
