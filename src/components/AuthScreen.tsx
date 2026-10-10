import React, { useState } from 'react';
import { CAMPUS_BLOCKS } from '../types';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  User,
  Hash,
} from 'lucide-react';

interface AuthScreenProps {
  isLoading: boolean;
  onLogin: (identifier: string, password: string) => void;
  onRegisterStudent: (
    email: string,
    password: string,
    name: string,
    phone: string,
    rollNo: string,
    block: string
  ) => void;
  onResetPassword: (email: string, newPassword: string) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  isLoading,
  onLogin,
  onRegisterStudent,
  onResetPassword,
}) => {
  const [selectedTab, setSelectedTab] = useState<0 | 1>(0);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regRollNo, setRegRollNo] = useState('');
  const [regBlock, setRegBlock] = useState('CB');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('482910');
  const [resetNewPass, setResetNewPass] = useState('');

  return (
    <div
      data-testid="auth_screen_root"
      className="min-h-screen w-full flex flex-col items-center justify-center px-4 py-8"
      style={{
        background: 'linear-gradient(180deg, #FAF3E8 0%, #FFFBF5 50%, #F3E8D6 100%)',
      }}
    >
      <div className="w-full max-w-[460px] flex flex-col items-center">
        <div className="w-24 h-24 rounded-3xl bg-nesty-creamSurface border-2 border-nesty-gold shadow-lg p-2 flex items-center justify-center">
          <img
            src="/images/nesty-logo.jpg"
            alt="Official Nesty Logo"
            className="w-full h-full object-contain rounded-2xl"
          />
        </div>

        <h1 className="mt-3.5 text-3xl font-extrabold tracking-[0.14em] text-nesty-burgundy">
          NESTY
        </h1>
        <p className="mt-1 text-sm font-medium text-nesty-textSecondary text-center">
          Smart Campus Food Ordering • CVR Canteen
        </p>

        <div className="mt-6 w-full bg-nesty-creamSurface border-[1.5px] border-nesty-gold rounded-3xl shadow-xl p-6">
          <div className="bg-nesty-creamElevated border border-nesty-creamBorder rounded-2xl p-1 grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => setSelectedTab(0)}
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
              onClick={() => setSelectedTab(1)}
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
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onLogin(loginEmail, loginPassword);
              }}
              className="mt-5 space-y-4"
            >
              <div>
                <h2 className="text-lg font-extrabold text-nesty-burgundy">Welcome Back</h2>
                <p className="text-xs text-nesty-textSecondary mt-0.5">
                  Sign in with your campus Student or Admin email address.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-nesty-textPrimary mb-1">
                  Campus Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-nesty-burgundy absolute left-3.5 top-3" />
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="student@cvr.ac.in"
                    data-testid="login_email_input"
                    required
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
                    setResetEmail(loginEmail);
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
                className="w-full py-3 rounded-xl bg-nesty-burgundy text-nesty-cream font-extrabold text-sm hover:bg-nesty-burgundyDark transition disabled:opacity-60 shadow-md"
              >
                {isLoading ? 'Signing in to Nesty...' : 'Sign In to Nesty'}
              </button>

              <hr className="border-nesty-creamBorder my-3" />

              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-nesty-textSecondary mb-2">
                  Instant Quick Access (Student & Admin Only):
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setLoginEmail('student@cvr.ac.in');
                      setLoginPassword('student123');
                      onLogin('student@cvr.ac.in', 'student123');
                    }}
                    data-testid="quick_student_login_button"
                    className="py-2.5 px-3 rounded-xl border border-nesty-gold bg-nesty-creamElevated text-nesty-burgundy font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-nesty-goldLight transition"
                  >
                    <User className="w-3.5 h-3.5" /> Student Demo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginEmail('admin@cvr.ac.in');
                      setLoginPassword('admin123');
                      onLogin('admin@cvr.ac.in', 'admin123');
                    }}
                    data-testid="quick_admin_login_button"
                    className="py-2.5 px-3 rounded-xl border border-nesty-gold bg-nesty-creamElevated text-nesty-burgundy font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-nesty-goldLight transition"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" /> Admin Portal
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onRegisterStudent(regEmail, regPassword, regName, regPhone, regRollNo, regBlock);
              }}
              className="mt-5 space-y-3.5"
            >
              <div>
                <h2 className="text-lg font-extrabold text-nesty-burgundy">
                  Create Student Account
                </h2>
                <p className="text-xs text-nesty-textSecondary mt-0.5">
                  Register with your campus roll number and get 50 Nesty welcome coins!
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-nesty-textPrimary mb-1">
                  Full Name
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
                  Campus Email
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
                    Roll No
                  </label>
                  <div className="relative">
                    <Hash className="w-4 h-4 text-nesty-burgundy absolute left-3 top-3" />
                    <input
                      type="text"
                      value={regRollNo}
                      onChange={(e) => setRegRollNo(e.target.value)}
                      placeholder="22B81A0501"
                      data-testid="register_roll_input"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-nesty-creamSurface border border-nesty-creamBorder text-xs focus:outline-none focus:border-nesty-burgundy"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-nesty-textPrimary mb-1">
                    Phone
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-nesty-burgundy absolute left-3 top-3" />
                    <input
                      type="tel"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="9848012345"
                      data-testid="register_phone_input"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-nesty-creamSurface border border-nesty-creamBorder text-xs focus:outline-none focus:border-nesty-burgundy"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-nesty-textPrimary mb-1.5">
                  Preferred Pickup Block
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {CAMPUS_BLOCKS.map((b) => {
                    const isSelected = regBlock === b.code;
                    return (
                      <button
                        type="button"
                        key={b.code}
                        onClick={() => setRegBlock(b.code)}
                        className={`py-2 rounded-xl text-xs font-extrabold border transition ${
                          isSelected
                            ? 'bg-nesty-burgundy text-nesty-cream border-nesty-gold'
                            : 'bg-nesty-creamElevated text-nesty-textPrimary border-nesty-creamBorder'
                        }`}
                      >
                        {b.code}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-nesty-textPrimary mb-1">
                  Create Password (min 6 chars)
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
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-nesty-creamSurface border border-nesty-creamBorder text-sm focus:outline-none focus:border-nesty-burgundy"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute right-3 top-2.5 text-nesty-textSecondary hover:text-nesty-burgundy"
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
                {isLoading ? 'Creating Account...' : 'Create Nesty Account'}
              </button>
            </form>
          )}
        </div>

        <div className="mt-5 flex items-center gap-1.5 text-xs text-nesty-textSecondary">
          <CheckCircle2 className="w-4 h-4 text-nesty-goldDark" />
          <span>Official Nesty Campus Dining • Powered by Secure Order IDs</span>
        </div>
      </div>

      {showResetDialog && (
        <div
          onClick={() => setShowResetDialog(false)}
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-nesty-creamSurface border-2 border-nesty-gold rounded-3xl shadow-2xl p-6 space-y-3.5"
          >
            <div className="flex items-center gap-2 text-nesty-burgundy">
              <KeyRound className="w-5 h-5" />
              <h3 className="text-base font-extrabold">Reset Nesty Password</h3>
            </div>
            <p className="text-xs text-nesty-textSecondary">
              Enter your registered campus email and choose a new password.
            </p>
            <div>
              <label className="block text-xs font-bold text-nesty-textPrimary mb-1">
                Registered Email
              </label>
              <input
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="student@cvr.ac.in"
                className="w-full px-3.5 py-2.5 rounded-xl bg-nesty-cream border border-nesty-gold text-xs focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-nesty-textPrimary mb-1">
                Campus Verification OTP
              </label>
              <input
                type="text"
                value={resetOtp}
                onChange={(e) => setResetOtp(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-nesty-cream border border-nesty-gold text-xs focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-nesty-textPrimary mb-1">
                New Password (min 6 chars)
              </label>
              <input
                type="password"
                value={resetNewPass}
                onChange={(e) => setResetNewPass(e.target.value)}
                placeholder="New password"
                className="w-full px-3.5 py-2.5 rounded-xl bg-nesty-cream border border-nesty-gold text-xs focus:outline-none"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResetDialog(false)}
                className="flex-1 py-2.5 rounded-xl border border-nesty-creamBorder text-xs font-bold text-nesty-textSecondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onResetPassword(resetEmail, resetNewPass);
                  setShowResetDialog(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-nesty-burgundy text-nesty-cream text-xs font-extrabold"
              >
                Update Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
