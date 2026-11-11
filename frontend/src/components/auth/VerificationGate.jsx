import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, ArrowRight, Mail, CheckCircle2, ChevronDown, ChevronUp
} from 'lucide-react';
import { 
  auth, 
  googleProvider, 
  appleProvider, 
  signInWithPopup,
  getRedirectResult 
} from '../../firebase';
import { sanitizeEmail, sanitizeOtpDigits } from '../../utils/sanitize';
import { API_BASE, setSessionToken } from '../../utils/apiClient';
import './VerificationGate.css';

export default function VerificationGate({ onVerified }) {
  // Collapsible Email OTP sign-in
  const [showEnterprise, setShowEnterprise] = useState(false);
  const [otpStep, setOtpStep] = useState('email'); // 'email' | 'code'

  // Email OTP state
  const [emailInput, setEmailInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [serverDemoCode, setServerDemoCode] = useState('');
  
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  // Check for Firebase Redirect result if popup wasn't used
  useEffect(() => {
    if (!auth) return;
    getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user) {
          await handleAuthenticateUser({ idToken: await result.user.getIdToken() });
        }
      })
      .catch((err) => {
        console.warn('[Auth] Redirect result error:', err);
      });
  }, []);

  // Exchanges a Firebase ID token for a server session. The server verifies the
  // token and the email; nothing here trusts a client-supplied identity.
  const handleAuthenticateUser = async ({ idToken }) => {
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

  // 1. Continue with Google (Real Google OAuth Popup)
  const handleGoogleSignIn = async () => {
    setError(null);
    setNotice(null);
    setAuthLoading(true);

    try {
      if (auth && googleProvider) {
        const result = await signInWithPopup(auth, googleProvider);
        if (result?.user) {
          await handleAuthenticateUser({ idToken: await result.user.getIdToken() });
          return;
        }
      }
    } catch (popupErr) {
      console.warn('[Google Auth] Popup aborted:', popupErr);
      if (popupErr.code === 'auth/popup-closed-by-user') {
        setAuthLoading(false);
        return;
      }
    }

    setAuthLoading(false);
    setError('Sign-in popup was blocked or closed. Allow popups for this site and try again.');
  };

  // 2. Continue with Apple (Real Apple ID Popup)
  const handleAppleSignIn = async () => {
    setError(null);
    setNotice(null);
    setAuthLoading(true);

    try {
      if (auth && appleProvider) {
        const result = await signInWithPopup(auth, appleProvider);
        if (result?.user) {
          await handleAuthenticateUser({ idToken: await result.user.getIdToken() });
          return;
        }
      }
    } catch (appleErr) {
      console.warn('[Apple Auth] Popup aborted:', appleErr);
      if (appleErr.code === 'auth/popup-closed-by-user') {
        setAuthLoading(false);
        return;
      }
    }

    setAuthLoading(false);
    setError('Sign-in popup was blocked or closed. Allow popups for this site and try again.');
  };

  // Email OTP: Send Verification Code
  const handleSendCode = async (e) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const cleanEmail = sanitizeEmail(emailInput, 100);
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError('Please enter a valid institutional or personal email address.');
      return;
    }

    setAuthLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.status !== 'success') {
        setError(data.error || 'Could not send a verification code. Please retry.');
        return;
      }
      if (data.demoCode) {
        setServerDemoCode(data.demoCode);
      }
      setNotice(`Verification code dispatched to ${cleanEmail}. Enter code to verify.`);
      setOtpStep('code');
    } catch {
      setError('Could not send a verification code. Please retry.');
      return;
    } finally {
      setAuthLoading(false);
    }
  };

  // Email OTP: Verify Code
  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const cleanCode = sanitizeOtpDigits(codeInput, 6);
    const cleanEmail = sanitizeEmail(emailInput, 100);

    if (!cleanCode || cleanCode.length < 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setAuthLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, code: cleanCode })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.user && data.sessionToken) {
        setSessionToken(data.sessionToken);
        localStorage.setItem('enverai_user_session', JSON.stringify(data.user));
        localStorage.setItem('enver_user_email', cleanEmail);
        onVerified(data.user);
      } else {
        setError(data.error || 'Invalid or expired verification code.');
      }
    } catch {
      setError('Verification could not be processed. Please check code.');
    } finally {
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
          <div className="verification-error animate-fade-up">
            <ShieldAlert size={16} />
            <span>{error}</span>
          </div>
        )}

        {notice && (
          <div className="verification-notice animate-fade-up">
            <CheckCircle2 size={16} />
            <span>{notice}</span>
          </div>
        )}

        {/* =========================================================================
            IMAGE 2 AUTH ACTION STACK: Pill Buttons (Real Log In)
           ========================================================================= */}
        <div className="auth-pill-actions">
          
          {/* 1. Green Pill: Create account */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={authLoading}
            className="auth-pill-btn green-pill-btn"
            id="btn-create-account"
          >
            <span>Create account</span>
          </button>

          {/* 2. Black/Dark Pill with Border: Continue with Google */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={authLoading}
            className="auth-pill-btn google-pill-btn"
            id="btn-continue-google"
          >
            <svg width="20" height="20" viewBox="0 0 18 18" className="auth-pill-icon">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.616z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" />
              <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.173 0 7.548 0 9s.347 2.827.957 4.039l3.007-2.332z" />
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" />
            </svg>
            <span>{authLoading ? 'Connecting to Google...' : 'Continue with Google'}</span>
          </button>

          {/* 3. Solid White Pill: Continue with Apple */}
          <button
            type="button"
            onClick={handleAppleSignIn}
            disabled={authLoading}
            className="auth-pill-btn apple-pill-btn"
            id="btn-continue-apple"
          >
            <svg width="20" height="20" viewBox="0 0 170 170" fill="currentColor" className="auth-pill-icon">
              <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.08-7.7-7.91-12.03-14.49-6.3-9.49-11.22-20.2-14.75-32.14-3.53-11.94-5.3-23.08-5.3-33.42 0-14.35 3.65-26.47 10.95-36.38 7.3-9.9 16.48-14.9 27.53-14.99 4.36 0 9.24 1.13 14.65 3.39 5.4 2.27 9.17 3.4 11.32 3.4 1.83 0 5.67-1.18 11.53-3.53 5.86-2.36 10.8-3.4 14.82-3.14 11.7.53 21.03 4.87 28.02 13.03-10.25 6.2-15.26 14.83-15.02 25.88.23 8.7 3.61 16.03 10.15 21.99 6.53 5.96 14.28 9.3 23.23 10.02-2.35 7.15-5.3 14.31-8.86 21.48zM119.22 33.15c0-7.39 2.65-14.16 7.95-20.31 5.3-6.15 11.75-9.87 19.34-11.16.22 1.3.33 2.45.33 3.46 0 7.42-2.73 14.34-8.19 20.76-5.46 6.42-12.01 10.1-19.65 11.05-.22-1.07-.34-2.18-.34-3.32z" />
            </svg>
            <span>{authLoading ? 'Connecting to Apple...' : 'Continue with Apple'}</span>
          </button>

        </div>

        {/* Terms and Privacy Policy Note (Image 2 Style) */}
        <p className="auth-terms-note">
          By continuing with Google or Apple, you agree to the{' '}
          <a href="#terms" onClick={(e) => e.preventDefault()} className="auth-terms-link">Terms and Conditions</a>{' '}
          and{' '}
          <a href="#privacy" onClick={(e) => e.preventDefault()} className="auth-terms-link">Privacy Policy</a>.
        </p>

        {/* Collapsible Email OTP Login Toggle */}
        <div className="auth-passkey-toggle-wrap">
          <button
            type="button"
            className="auth-passkey-toggle-btn"
            onClick={() => setShowEnterprise(prev => !prev)}
            aria-expanded={showEnterprise}
          >
            <Mail size={13} />
            <span>Sign in with Email Code</span>
            {showEnterprise ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>

        {/* Collapsible Email OTP Form */}
        {showEnterprise && (
          <div className="auth-passkey-accordion animate-fade-up">
            <div className="auth-divider">
              <span>Email OTP Verification</span>
            </div>

            <div>
                {otpStep === 'email' ? (
                  <form onSubmit={handleSendCode} autoComplete="on" noValidate>
                    <div style={{ marginBottom: '1rem' }}>
                      <label className="input-label" htmlFor="user_corporate_email">
                        Institutional Email Address
                      </label>
                      <input
                        id="user_corporate_email"
                        name="email"
                        type="email"
                        required
                        maxLength={100}
                        className="input-field"
                        placeholder="e.g. officer@idbibank.in"
                        value={emailInput}
                        onChange={(e) => setEmailInput(sanitizeEmail(e.target.value, 100))}
                        autoComplete="email"
                        spellCheck="false"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={authLoading || !emailInput}
                      className="btn-primary"
                      style={{ width: '100%', padding: '11px', borderRadius: '9999px' }}
                    >
                      {authLoading ? 'Dispatching Code...' : 'Send Verification Code'}
                      {!authLoading && <ArrowRight size={16} />}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyCode} autoComplete="on" noValidate>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.74rem', color: '#71717A' }}>
                        Verifying: <strong style={{ color: '#FAFAFA' }}>{emailInput}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => { setOtpStep('email'); setNotice(null); }}
                        style={{ background: 'none', border: 'none', color: '#10B981', fontSize: '0.72rem', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        Change
                      </button>
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                      <label className="input-label" htmlFor="user_otp_code">
                        Enter 6-Digit Code
                      </label>
                      <input
                        id="user_otp_code"
                        name="one-time-code"
                        type="text"
                        required
                        maxLength={6}
                        autoFocus
                        className="input-field"
                        placeholder="••••••"
                        value={codeInput}
                        onChange={(e) => setCodeInput(sanitizeOtpDigits(e.target.value, 6))}
                        autoComplete="one-time-code"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '1.25rem',
                          letterSpacing: '0.3em',
                          textAlign: 'center',
                          fontWeight: 700
                        }}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={authLoading || codeInput.length < 6}
                      className="btn-accent"
                      style={{ width: '100%', padding: '11px', borderRadius: '9999px', background: '#10B981', color: '#000000', fontWeight: 700 }}
                    >
                      {authLoading ? 'Verifying...' : 'Confirm Code & Enter Citadel'}
                      {!authLoading && <ArrowRight size={16} />}
                    </button>
                  </form>
                )}
            </div>
          </div>
        )}

        <div style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.66rem', color: '#71717A', fontFamily: 'var(--font-mono)' }}>
          Enver AI Tech Pvt. Ltd. · Microsoft Azure Citadel · RBI Mandate
        </div>

      </div>
    </div>
  );
}
