import React, { useState, useEffect } from 'react';
import { ShieldAlert, CheckCircle2, Mail } from 'lucide-react';
import { startEntraSignIn, completeEntraRedirect } from '../../auth/entraAuth';
import { API_BASE, setSessionToken } from '../../utils/apiClient';
import './VerificationGate.css';

export default function VerificationGate({ onVerified }) {
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  // Exchanges an Entra ID token for a server session. The server verifies the
  // token and the email; nothing here trusts a client-supplied identity.
  const handleAuthenticateUser = async (idToken) => {
    setAuthLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.status === 'success' && data.user && data.sessionToken) {
        setSessionToken(data.sessionToken);
        localStorage.setItem('enverai_user_session', JSON.stringify(data.user));
        localStorage.setItem('enver_user_email', data.user.email);
        onVerified(data.user);
      } else {
        setSessionToken(null);
        setError(data.error || 'Sign-in could not be verified. Please retry.');
      }
    } catch {
      setSessionToken(null);
      setError('The sign-in service could not be reached. Please retry.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Returning from the hosted Microsoft sign-in page.
  useEffect(() => {
    let cancelled = false;
    completeEntraRedirect()
      .then((idToken) => {
        if (!cancelled && idToken) {
          setNotice('Signed in with Microsoft. Opening your workspace...');
          handleAuthenticateUser(idToken);
        }
      })
      .catch((err) => {
        // No redirect in progress is the normal case; only report real failures.
        if (!cancelled && err?.errorCode && err.errorCode !== 'no_token_request_cache_error') {
          console.warn('[Auth] Sign-in redirect failed:', err);
          setError(err.errorCode === 'user_cancelled' ? null : 'Sign-in was not completed. Please try again.');
        }
      });
    return () => { cancelled = true; };
  }, []);

  const handleSignIn = async () => {
    setError(null);
    setNotice(null);
    setAuthLoading(true);
    try {
      await startEntraSignIn(); // navigates away on success
    } catch (err) {
      console.warn('[Auth] Could not start sign-in:', err);
      setError(err?.message === 'Sign-in is not configured yet.' ? err.message : 'Could not open the sign-in page. Please retry.');
      setAuthLoading(false);
    }
  };

  return (
    <div className="verification-gate-overlay animate-fade-up">
      <div className="auth-pill-card">

        {/* Brand Header */}
        <div className="auth-card-header">
          <div className="auth-brand-emblem-wrap">
            <img src="/enver_logo.png" alt="Enver AI Tech" className="auth-brand-emblem" />
          </div>
          <h1 className="auth-main-title">Enver AI Tech</h1>
          <div className="auth-product-badge">Artificer Citadel</div>
          <p className="auth-main-subtitle">
            Autonomous Multi-Agent Underwriting for MSMEs · Institutional Risk Intelligence
          </p>
        </div>

        {error && (
          <div className="verification-error animate-fade-up" role="alert">
            <ShieldAlert size={16} />
            <span>{error}</span>
          </div>
        )}

        {notice && (
          <div className="verification-notice animate-fade-up" role="status" aria-live="polite">
            <CheckCircle2 size={16} />
            <span>{notice}</span>
          </div>
        )}

        <div className="auth-pill-actions">
          <button
            type="button"
            onClick={handleSignIn}
            disabled={authLoading}
            className="auth-pill-btn green-pill-btn"
            id="btn-sign-in"
          >
            <span>{authLoading ? 'Opening secure sign-in...' : 'Sign in or create account'}</span>
          </button>
        </div>

        <p className="auth-terms-note" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Mail size={13} /> Email code, Google or Apple · secured by Microsoft Entra
        </p>

        <p className="auth-terms-note">
          By continuing, you agree to the{' '}
          <a href="#terms" onClick={(e) => e.preventDefault()} className="auth-terms-link">Terms and Conditions</a>{' '}
          and{' '}
          <a href="#privacy" onClick={(e) => e.preventDefault()} className="auth-terms-link">Privacy Policy</a>.
        </p>

        <div style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.66rem', color: '#71717A', fontFamily: 'var(--font-mono)' }}>
          Enver AI Tech Pvt. Ltd. · Microsoft Azure Citadel · RBI Mandate
        </div>

      </div>
    </div>
  );
}
