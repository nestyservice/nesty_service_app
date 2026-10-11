import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  Phone,
  User,
  Hash,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { UserAccount } from '../types';

interface AuthScreenProps {
  isLoading: boolean;
  onLogin: (identifier: string, password: string) => void;
  onRegisterStudent: (
    email: string,
    password: string,
    name: string,
    phone: string,
    rollNo: string
  ) => void;
  onSessionEstablished?: (token: string, user: UserAccount) => void;
  onResetPassword?: (email: string, newPassword: string) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  isLoading: externalLoading,
  onLogin,
  onRegisterStudent,
  onSessionEstablished,
}) => {
  const [selectedTab, setSelectedTab] = useState<0 | 1>(0);

  // Sign In state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Student Sign Up state (No pickup block!)
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regRollNo, setRegRollNo] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Local loading & feedback state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authFeedback, setAuthFeedback] = useState<{ message: string; isError: boolean } | null>(null);

  // First-Time Login / Registration Email Verification OTP State (Requirement #1)
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState('');
  const [verifyingLoading, setVerifyingLoading] = useState(false);
  const [verifyingError, setVerifyingError] = useState<string | null>(null);
  const [verifyingSuccess, setVerifyingSuccess] = useState<string | null>(null);
  const [verifyingCooldown, setVerifyingCooldown] = useState(0);

  // Forgot Password Dialog State (Requirement #2.A)
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [resetNewPass, setResetNewPass] = useState('');
  const [showResetNewPass, setShowResetNewPass] = useState(false);
  const [resetStep, setResetStep] = useState<1 | 2>(1);
  const [resetFeedback, setResetFeedback] = useState<{ message: string; isError: boolean } | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingReset, setIsVerifyingReset] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Verification cooldown timer
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (verifyingCooldown > 0) {
      timer = setInterval(() => {
        setVerifyingCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [verifyingCooldown]);

  // Forgot password cooldown timer
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Handle Unified Login Form Submission
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthFeedback(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: loginIdentifier.trim(),
          password: loginPassword,
        }),
      });
      const data = await res.json();

      if (data.requiresVerification && data.email) {
        // Account unverified: transition directly to First-Time OTP Screen
        setVerifyingEmail(data.email);
        setIsVerifyingEmail(true);
        setVerifyingCooldown(60);
        setVerifyingSuccess(data.message || 'A verification code has been dispatched to your registered college email.');
        setVerifyingError(null);
      } else if (!res.ok || !data.success) {
        setAuthFeedback({ message: data.message || 'Invalid credentials. Please verify your email/roll number and password.', isError: true });
      } else {
        // Successful login without OTP
        if (onSessionEstablished) {
          onSessionEstablished(data.token, data.user);
        } else {
          onLogin(loginIdentifier.trim(), loginPassword);
        }
      }
    } catch {
      setAuthFeedback({ message: 'Network error connecting to NESTY server. Please check your connection.', isError: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Student Registration Form Submission (No Pickup Block)
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthFeedback(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/register-student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: regEmail.trim(),
          password: regPassword,
          name: regName.trim(),
          phone: regPhone.trim(),
          rollNo: regRollNo.trim(),
        }),
      });
      const data = await res.json();

      if (data.requiresVerification && data.email) {
        // Transition directly to OTP verification screen before granting dashboard access
        setVerifyingEmail(data.email);
        setIsVerifyingEmail(true);
        setVerifyingCooldown(60);
        setVerifyingSuccess(data.message || 'Verification code sent to your registered college email.');
        setVerifyingError(null);
      } else if (!res.ok || !data.success) {
        setAuthFeedback({ message: data.message || 'Registration failed. Please check your details.', isError: true });
      } else {
        if (onSessionEstablished) {
          onSessionEstablished(data.token, data.user);
        } else {
          onRegisterStudent(regEmail, regPassword, regName, regPhone, regRollNo);
        }
      }
    } catch {
      setAuthFeedback({ message: 'Network error connecting to NESTY server.', isError: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Email Verification Confirmation (Requirement #1)
  const handleConfirmEmailVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyingError(null);
    setVerifyingSuccess(null);

    if (!verifyingOtp.trim()) {
      setVerifyingError('Please enter the 6-digit verification code.');
      return;
    }

    setVerifyingLoading(true);
    try {
      const res = await fetch('/api/auth/verify-email/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: verifyingEmail.trim(),
          otp: verifyingOtp.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setVerifyingError(data.message || 'Invalid OTP');
      } else {
        setVerifyingSuccess('Email verified successfully! Opening your canteen tray...');
        setTimeout(() => {
          if (onSessionEstablished) {
            onSessionEstablished(data.token, data.user);
          } else {
            onLogin(verifyingEmail, loginPassword || regPassword);
          }
        }, 1200);
      }
    } catch {
      setVerifyingError('Network error confirming verification code.');
    } finally {
      setVerifyingLoading(false);
    }
  };

  // Handle Resend Verification OTP (Requirement #1)
  const handleResendVerificationOtp = async () => {
    setVerifyingError(null);
    setVerifyingSuccess(null);
    setVerifyingLoading(true);

    try {
      const res = await fetch('/api/auth/verify-email/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verifyingEmail.trim() }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setVerifyingError(data.message || 'Failed to dispatch verification code.');
      } else {
        setVerifyingCooldown(60);
        setVerifyingSuccess('A new verification code has been dispatched to your college email.');
      }
    } catch {
      setVerifyingError('Network error requesting verification code.');
    } finally {
      setVerifyingLoading(false);
    }
  };

  // Handle Forgot Password - Request OTP (Requirement #2.A)
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetFeedback(null);
    if (!resetEmail.trim() || !resetEmail.includes('@')) {
      setResetFeedback({ message: 'Please enter a valid campus email address.', isError: true });
      return;
    }

    setIsSendingOtp(true);
    try {
      const res = await fetch('/api/auth/forgot-password/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResetStep(2);
        setResendCooldown(60);
        setResetFeedback({
          message: data.message || 'Verification code sent to your registered college email.',
          isError: false,
        });
      } else {
        setResetFeedback({ message: data.message || 'Failed to send verification code.', isError: true });
      }
    } catch {
      setResetFeedback({ message: 'Network error connecting to auth server.', isError: true });
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Handle Forgot Password - Verify OTP & Set New Password (Requirement #2.A)
  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetFeedback(null);
    if (!resetOtp.trim()) {
      setResetFeedback({ message: 'Please enter the 6-digit verification code.', isError: true });
      return;
    }
    if (resetNewPass.length < 6) {
      setResetFeedback({ message: 'New password must be at least 6 characters.', isError: true });
      return;
    }

    setIsVerifyingReset(true);
    try {
      const res = await fetch('/api/auth/forgot-password/verify-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resetEmail.trim(),
          otp: resetOtp.trim(),
          newPassword: resetNewPass,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResetFeedback({
          message: data.message || 'Password updated successfully! You can now sign in with your new password.',
          isError: false,
        });
        setTimeout(() => {
          setShowResetDialog(false);
          setResetStep(1);
          setResetOtp('');
          setResetNewPass('');
          setResetFeedback(null);
          setLoginIdentifier(resetEmail);
        }, 1800);
      } else {
        setResetFeedback({ message: data.message || 'Invalid OTP', isError: true });
      }
    } catch {
      setResetFeedback({ message: 'Network error during password reset.', isError: true });
    } finally {
      setIsVerifyingReset(false);
    }
  };

  const isLoading = externalLoading || isSubmitting;

  return (
    <div
      data-testid="auth_screen_root"
      className="min-h-screen w-full flex flex-col items-center justify-center px-4 py-8"
      style={{
        background: 'linear-gradient(180deg, #FAF3E8 0%, #FFFBF5 50%, #F3E8D6 100%)',
      }}
    >
      <div className="w-full max-w-[460px] flex flex-col items-center">
        {/* Official Brand Logo */}
        <div className="w-24 h-24 rounded-3xl bg-nesty-creamSurface border-2 border-nesty-gold shadow-lg p-2 flex items-center justify-center">
          <img
            src="/images/nesty-logo.jpg"
            alt="Official NESTY Logo"
            className="w-full h-full object-contain rounded-2xl"
          />
        </div>

        <h1 className="mt-3.5 text-3xl font-extrabold tracking-[0.14em] text-nesty-burgundy">
          NESTY
        </h1>
        <p className="mt-1 text-sm font-medium text-nesty-textSecondary text-center">
          Campus Food Ordering • Fresh & Fast
        </p>

        {/* Card Container */}
        <div className="mt-6 w-full bg-nesty-creamSurface border-[1.5px] border-nesty-gold rounded-3xl shadow-xl p-6">
          {authFeedback && (
            <div
              className={`mb-4 p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                authFeedback.isError
                  ? 'bg-nesty-errorBg border-nesty-error text-nesty-error'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-800'
              }`}
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{authFeedback.message}</span>
            </div>
          )}

          {/* VIEW A: FIRST-TIME STUDENT EMAIL VERIFICATION SCREEN (Requirement #1) */}
          {isVerifyingEmail ? (
            <div className="space-y-4 animate-fadeIn">
              <div className="text-center pb-2 border-b border-nesty-creamBorder">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-nesty-burgundy/10 text-nesty-burgundy mb-2">
                  <ShieldCheck className="w-6 h-6 text-nesty-burgundy" />
                </div>
                <h2 className="text-lg font-extrabold text-nesty-burgundy">
                  Verify College Email
                </h2>
                <p className="text-xs text-nesty-textSecondary mt-1">
                  We've sent a 6-digit verification code to:
                </p>
                <div className="mt-1 text-xs font-mono font-bold text-nesty-burgundy bg-nesty-cream px-3 py-1 rounded-lg inline-block border border-nesty-creamBorder">
                  {verifyingEmail}
                </div>
              </div>

              {verifyingError && (
                <div className="p-3 rounded-xl bg-nesty-errorBg border border-nesty-error text-nesty-error text-xs flex items-center gap-2 font-bold">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{verifyingError}</span>
                </div>
              )}

              {verifyingSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs flex items-center gap-2 font-bold">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                  <span>{verifyingSuccess}</span>
                </div>
              )}

              <form onSubmit={handleConfirmEmailVerification} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-nesty-textPrimary mb-1 text-center">
                    Enter 6-Digit Verification Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={verifyingOtp}
                    onChange={(e) => setVerifyingOtp(e.target.value)}
                    placeholder="e.g. 123456"
                    data-testid="verification_otp_input"
                    required
                    autoFocus
                    className="w-full px-4 py-3 rounded-xl bg-nesty-cream border border-nesty-creamBorder text-base font-mono tracking-widest text-center focus:outline-none focus:border-nesty-burgundy"
                  />
                  <p className="text-[11px] text-stone-500 text-center mt-1">
                    Valid for 10 minutes. Check your college inbox or spam folder.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={verifyingLoading}
                  data-testid="confirm_verification_button"
                  className="w-full py-3.5 rounded-xl bg-nesty-burgundy text-nesty-cream font-extrabold text-sm hover:bg-nesty-burgundyDark transition disabled:opacity-60 shadow-md flex items-center justify-center gap-2"
                >
                  <span>{verifyingLoading ? 'Verifying Code...' : 'Verify & Open NESTY'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              <div className="flex items-center justify-between pt-2 border-t border-nesty-creamBorder text-xs font-bold">
                <button
                  type="button"
                  onClick={handleResendVerificationOtp}
                  disabled={verifyingCooldown > 0 || verifyingLoading}
                  data-testid="resend_verification_button"
                  className="text-nesty-burgundy hover:underline disabled:text-stone-400"
                >
                  {verifyingCooldown > 0 ? `Resend code in ${verifyingCooldown}s` : 'Resend OTP'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsVerifyingEmail(false);
                    setVerifyingOtp('');
                    setVerifyingError(null);
                    setVerifyingSuccess(null);
                  }}
                  data-testid="cancel_verification_button"
                  className="text-nesty-textSecondary hover:text-nesty-burgundy"
                >
                  ← Back to Sign In
                </button>
              </div>
            </div>
          ) : (
            /* VIEW B: UNIFIED LOGIN & REGISTRATION TABS */
            <>
              <div className="bg-nesty-creamElevated border border-nesty-creamBorder rounded-2xl p-1 grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTab(0);
                    setAuthFeedback(null);
                  }}
                  data-testid="auth_tab_signin"
                  className={`py-2.5 rounded-xl text-xs font-extrabold transition ${
                    selectedTab === 0
                      ? 'bg-nesty-burgundy text-nesty-cream shadow-sm'
                      : 'text-nesty-textSecondary hover:text-nesty-burgundy'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTab(1);
                    setAuthFeedback(null);
                  }}
                  data-testid="auth_tab_signup"
                  className={`py-2.5 rounded-xl text-xs font-extrabold transition ${
                    selectedTab === 1
                      ? 'bg-nesty-burgundy text-nesty-cream shadow-sm'
                      : 'text-nesty-textSecondary hover:text-nesty-burgundy'
                  }`}
                >
                  Student Sign Up
                </button>
              </div>

              {selectedTab === 0 ? (
                /* UNIFIED LOGIN FORM: Email / Roll Number + Password (No OTP on ordinary login) */
                <form onSubmit={handleLoginSubmit} className="mt-5 space-y-4">
                  <div>
                    <h2 className="text-lg font-extrabold text-nesty-burgundy">Sign In to Your Account</h2>
                    <p className="text-xs text-nesty-textSecondary mt-0.5">
                      Enter your registered campus email or roll number and password.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-nesty-textPrimary mb-1">
                      College Email or Roll Number
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-nesty-burgundy absolute left-3.5 top-3" />
                      <input
                        type="text"
                        value={loginIdentifier}
                        onChange={(e) => setLoginIdentifier(e.target.value)}
                        placeholder="student@cvr.ac.in or 22B81A0501"
                        data-testid="login_email_input"
                        required
                        autoComplete="username"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-nesty-creamSurface border border-nesty-creamBorder text-sm focus:outline-none focus:border-nesty-burgundy"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-nesty-textPrimary mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-nesty-burgundy absolute left-3.5 top-3" />
                      <input
                        type={showLoginPassword ? 'text' : 'password'}
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        data-testid="login_password_input"
                        required
                        autoComplete="current-password"
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-nesty-creamSurface border border-nesty-creamBorder text-sm focus:outline-none focus:border-nesty-burgundy"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className="absolute right-3 top-2.5 text-nesty-textSecondary hover:text-nesty-burgundy"
                        aria-label="Toggle password visibility"
                      >
                        {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setResetEmail(loginIdentifier.includes('@') ? loginIdentifier : '');
                        setResetStep(1);
                        setResetFeedback(null);
                        setShowResetDialog(true);
                      }}
                      data-testid="forgot_password_button"
                      className="text-xs font-bold text-nesty-burgundy hover:underline"
                    >
                      Forgot Password?
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    data-testid="login_submit_button"
                    className="w-full py-3 rounded-xl bg-nesty-burgundy text-nesty-cream font-extrabold text-sm hover:bg-nesty-burgundyDark transition disabled:opacity-60 shadow-md flex items-center justify-center gap-2"
                  >
                    <span>{isLoading ? 'Signing in...' : 'Sign In to NESTY'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                /* STUDENT REGISTRATION FORM: No Pickup Block! No Coins references */
                <form onSubmit={handleRegisterSubmit} className="mt-5 space-y-3.5">
                  <div>
                    <h2 className="text-lg font-extrabold text-nesty-burgundy">
                      Create Student Account
                    </h2>
                    <p className="text-xs text-nesty-textSecondary mt-0.5">
                      Sign up with your campus roll number for instant food ordering.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-nesty-textPrimary mb-1">
                      Full Name *
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-nesty-burgundy absolute left-3.5 top-3" />
                      <input
                        type="text"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="Aarav Reddy"
                        data-testid="register_name_input"
                        required
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-nesty-creamSurface border border-nesty-creamBorder text-sm focus:outline-none focus:border-nesty-burgundy"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-nesty-textPrimary mb-1">
                      College Email *
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-nesty-burgundy absolute left-3.5 top-3" />
                      <input
                        type="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="22b81a0501@cvr.ac.in"
                        data-testid="register_email_input"
                        required
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-nesty-creamSurface border border-nesty-creamBorder text-sm focus:outline-none focus:border-nesty-burgundy"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-bold text-nesty-textPrimary mb-1">
                        Roll Number *
                      </label>
                      <div className="relative">
                        <Hash className="w-4 h-4 text-nesty-burgundy absolute left-3 top-3" />
                        <input
                          type="text"
                          value={regRollNo}
                          onChange={(e) => setRegRollNo(e.target.value.toUpperCase())}
                          placeholder="22B81A0501"
                          data-testid="register_roll_input"
                          required
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-nesty-creamSurface border border-nesty-creamBorder text-xs focus:outline-none focus:border-nesty-burgundy"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-nesty-textPrimary mb-1">
                        Phone Number *
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-nesty-burgundy absolute left-3 top-3" />
                        <input
                          type="tel"
                          value={regPhone}
                          onChange={(e) => setRegPhone(e.target.value)}
                          placeholder="9848012345"
                          data-testid="register_phone_input"
                          required
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-nesty-creamSurface border border-nesty-creamBorder text-xs focus:outline-none focus:border-nesty-burgundy"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-nesty-textPrimary mb-1">
                      Create Password (min 6 chars) *
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-nesty-burgundy absolute left-3.5 top-3" />
                      <input
                        type={showRegPassword ? 'text' : 'password'}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="••••••••"
                        data-testid="register_password_input"
                        required
                        minLength={6}
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-nesty-creamSurface border border-nesty-creamBorder text-sm focus:outline-none focus:border-nesty-burgundy"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute right-3 top-2.5 text-nesty-textSecondary hover:text-nesty-burgundy"
                        aria-label="Toggle password visibility"
                      >
                        {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    data-testid="register_submit_button"
                    className="w-full py-3 rounded-xl bg-nesty-burgundy text-nesty-cream font-extrabold text-sm hover:bg-nesty-burgundyDark transition disabled:opacity-60 shadow-md"
                  >
                    {isLoading ? 'Creating Account...' : 'Create NESTY Account'}
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        <div className="mt-5 flex items-center gap-1.5 text-xs text-nesty-textSecondary">
          <CheckCircle2 className="w-4 h-4 text-nesty-goldDark" />
          <span>Official NESTY Campus Dining • Instant Order & Transaction ID</span>
        </div>
      </div>

      {/* PASSWORD RESET WITH COLLEGE EMAIL OTP MODAL (Requirement #2.A) */}
      {showResetDialog && (
        <div
          onClick={() => setShowResetDialog(false)}
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-nesty-creamSurface border-2 border-nesty-gold rounded-3xl shadow-2xl p-6 space-y-4"
          >
            <div className="flex items-center gap-2 text-nesty-burgundy">
              <KeyRound className="w-5 h-5" />
              <h3 className="text-base font-extrabold">Reset NESTY Password</h3>
            </div>

            <p className="text-xs text-nesty-textSecondary">
              {resetStep === 1
                ? 'Enter your registered campus email to receive a 6-digit verification code.'
                : `Enter the 6-digit verification code sent to ${resetEmail} and your new password.`}
            </p>

            {resetFeedback && (
              <div
                className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                  resetFeedback.isError
                    ? 'bg-nesty-errorBg border-nesty-error text-nesty-error'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                }`}
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{resetFeedback.message}</span>
              </div>
            )}

            {resetStep === 1 ? (
              <form onSubmit={handleRequestOtp} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-nesty-textPrimary mb-1">
                    College Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-nesty-burgundy absolute left-3 top-2.5" />
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="student@cvr.ac.in"
                      required
                      data-testid="forgot_password_email_input"
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-nesty-creamSurface border border-nesty-creamBorder text-xs focus:outline-none focus:border-nesty-burgundy"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowResetDialog(false)}
                    className="flex-1 py-2.5 rounded-xl border border-nesty-creamBorder text-xs font-bold text-nesty-textSecondary hover:bg-nesty-cream"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSendingOtp}
                    data-testid="forgot_password_send_otp_button"
                    className="flex-1 py-2.5 rounded-xl bg-nesty-burgundy text-nesty-cream text-xs font-extrabold hover:bg-nesty-burgundyDark transition disabled:opacity-50"
                  >
                    {isSendingOtp ? 'Sending Code...' : 'Send OTP'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleConfirmReset} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-nesty-textPrimary mb-1">
                    6-Digit Verification Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={resetOtp}
                    onChange={(e) => setResetOtp(e.target.value)}
                    placeholder="e.g. 123456"
                    required
                    data-testid="forgot_password_otp_input"
                    className="w-full px-3 py-2 rounded-xl bg-nesty-creamSurface border border-nesty-creamBorder text-sm font-mono tracking-widest text-center focus:outline-none focus:border-nesty-burgundy"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-nesty-textPrimary mb-1">
                    New Password (min 6 chars)
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-nesty-burgundy absolute left-3 top-2.5" />
                    <input
                      type={showResetNewPass ? 'text' : 'password'}
                      value={resetNewPass}
                      onChange={(e) => setResetNewPass(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      data-testid="forgot_password_new_password_input"
                      className="w-full pl-9 pr-9 py-2 rounded-xl bg-nesty-creamSurface border border-nesty-creamBorder text-xs focus:outline-none focus:border-nesty-burgundy"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetNewPass(!showResetNewPass)}
                      className="absolute right-3 top-2.5 text-nesty-textSecondary"
                    >
                      {showResetNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={handleRequestOtp}
                    disabled={resendCooldown > 0 || isSendingOtp}
                    className="font-bold text-nesty-burgundy hover:underline disabled:text-stone-400"
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setResetStep(1)}
                    className="flex-1 py-2.5 rounded-xl border border-nesty-creamBorder text-xs font-bold text-nesty-textSecondary hover:bg-nesty-cream"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isVerifyingReset}
                    data-testid="forgot_password_confirm_button"
                    className="flex-1 py-2.5 rounded-xl bg-nesty-burgundy text-nesty-cream text-xs font-extrabold hover:bg-nesty-burgundyDark transition disabled:opacity-50"
                  >
                    {isVerifyingReset ? 'Saving...' : 'Update Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
