import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowLeft, Loader2, KeyRound, Check } from 'lucide-react';
import { resetPassword } from '../lib/auth';

export const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!token.trim()) {
      setError('Password reset token is missing from the URL. Please click the link received in your email or request a new reset link.');
    }
  }, [token]);

  const hasMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const isFormValid = hasMinLength && hasUpper && hasLower && hasNumber && hasSpecial && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('Missing reset token. Please request a new password reset email.');
      return;
    }

    if (!isFormValid) {
      setError('Please ensure your password meets all complexity requirements and passwords match.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await resetPassword(token, password);
      if (res.success) {
        setSuccess(res.message || 'Your password has been successfully reset.');
      } else {
        setError(res.error || 'Failed to reset password. The link may have expired or already been used.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#111315] text-slate-900 dark:text-[#F2F1ED] flex flex-col justify-center items-center px-4 py-12 font-sans selection:bg-[#C58A52]/20 selection:text-[#C58A52]">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-sm bg-slate-50 dark:bg-[#171A1D] border border-slate-200 dark:border-[#30363B] rounded-lg p-6 sm:p-7 shadow-sm"
      >
        <div className="flex items-center justify-between mb-6">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 dark:text-[#747C84] dark:hover:text-[#F2F1ED] transition-colors"
          >
            <ArrowLeft size={13} />
            <span>Home</span>
          </Link>
          <div className="w-7 h-7 rounded-md bg-white dark:bg-[#202428] border border-slate-200 dark:border-[#30363B] flex items-center justify-center text-[#C58A52]">
            <KeyRound size={14} />
          </div>
        </div>

        <div className="mb-6">
          <h1 className="text-lg font-bold text-slate-900 dark:text-[#F2F1ED] mb-1">
            Reset Account Password
          </h1>
          <p className="text-xs text-slate-500 dark:text-[#747C84]">
            Establish a new, strong password for your Avartah Solutions account.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-2.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-md text-red-600 dark:text-red-400 text-xs flex items-start gap-2">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <div className="leading-relaxed">{error}</div>
          </div>
        )}

        {success ? (
          <div className="text-center py-4 space-y-4">
            <div className="w-10 h-10 rounded-md bg-[#171A1D] border border-[#30363B] text-[#C58A52] flex items-center justify-center mx-auto">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-[#F2F1ED]">Password Updated</h3>
              <p className="text-xs text-slate-500 dark:text-[#747C84] mt-1">{success}</p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="w-full py-2.5 px-4 bg-[#C58A52] hover:bg-[#D99B62] text-[#111315] font-semibold text-xs rounded-lg transition-colors shadow-sm"
            >
              Sign In to Your Account
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-900 dark:text-[#F2F1ED] mb-1">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading || !token}
                  placeholder="Enter new password"
                  required
                  className="w-full px-3.5 py-2 pr-10 rounded-lg border border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#111315] text-xs text-slate-900 dark:text-[#F2F1ED] placeholder:text-slate-400 dark:placeholder:text-[#747C84] focus:outline-none focus:border-[#C58A52] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-[#F2F1ED]"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-900 dark:text-[#F2F1ED] mb-1">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading || !token}
                  placeholder="Repeat new password"
                  required
                  className="w-full px-3.5 py-2 pr-10 rounded-lg border border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#111315] text-xs text-slate-900 dark:text-[#F2F1ED] placeholder:text-slate-400 dark:placeholder:text-[#747C84] focus:outline-none focus:border-[#C58A52] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-[#F2F1ED]"
                >
                  {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Password Complexity Checklist */}
            <div className="p-3 rounded-md bg-white dark:bg-[#111315] border border-slate-200 dark:border-[#30363B] space-y-1.5 text-[11px]">
              <div className="text-slate-500 dark:text-[#747C84] font-medium mb-1">Requirements:</div>
              {[
                { label: 'Minimum 8 characters', met: hasMinLength },
                { label: 'Uppercase & lowercase letters', met: hasUpper && hasLower },
                { label: 'At least one number & symbol', met: hasNumber && hasSpecial },
                { label: 'Passwords match', met: passwordsMatch }
              ].map((req) => (
                <div key={req.label} className={`flex items-center gap-1.5 ${req.met ? 'text-[#C58A52]' : 'text-slate-400 dark:text-[#747C84]'}`}>
                  <Check size={12} className={req.met ? 'opacity-100' : 'opacity-40'} />
                  <span>{req.label}</span>
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={isLoading || !isFormValid || !token}
              className="w-full py-2.5 px-4 bg-[#C58A52] hover:bg-[#D99B62] disabled:opacity-50 text-[#111315] font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
            >
              {isLoading ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <span>Update Password</span>
              )}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
};

export default ResetPassword;
