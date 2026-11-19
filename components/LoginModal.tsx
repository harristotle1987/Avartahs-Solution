import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Eye, EyeOff, Loader2, ArrowLeft, CheckCircle2, Lock, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { login, register, requestPasswordReset } from '../lib/auth';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  defaultMode?: 'login' | 'register' | 'forgot';
  returnTo?: string;
}

export const LoginModal: React.FC<LoginModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  defaultMode = 'login',
  returnTo 
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(defaultMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setSuccessMessage(null);
      setPassword('');
    } else {
      setMode(defaultMode);
    }
  }, [isOpen, defaultMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (mode === 'forgot') {
        const res = await requestPasswordReset(email.trim());
        if (!res.success) {
          setError(res.error || 'Password reset request failed.');
        } else {
          setSuccessMessage(res.message || 'If an account exists with this email address, password reset instructions have been dispatched.');
        }
        return;
      }

      let res;
      if (mode === 'register') {
        res = await register(email.trim(), password);
      } else {
        res = await login(email.trim(), password);
      }

      if (!res?.success) {
        throw new Error('Authentication failed. Please verify credentials.');
      }

      if (onSuccess) {
        await onSuccess();
      }
      onClose();

      const userRole = res.user?.role;
      if (userRole === 'admin') {
        navigate(returnTo || '/admin/dashboard');
      } else {
        if (returnTo && (returnTo.startsWith('/admin') || returnTo.startsWith('/jobs'))) {
          navigate('/client/projects');
        } else {
          navigate(returnTo || '/client/projects');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            if (!isLoading) onClose();
          }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[1000] flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.98, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.98, opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#171A1D] border border-slate-200 dark:border-[#30363B] rounded-lg p-6 sm:p-7 w-full max-w-sm shadow-xl relative"
          >
            {/* Header */}
            <div className="flex justify-between items-start mb-5">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-[#F2F1ED]">
                  {mode === 'login' ? 'Sign In to Workspace' : mode === 'register' ? 'Create Client Account' : 'Password Recovery'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-[#747C84] mt-0.5">
                  Avartah Solutions Authentication
                </p>
              </div>
              <button 
                onClick={onClose} 
                disabled={isLoading}
                className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-[#F2F1ED] rounded-md transition-colors"
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Segmented Mode Switcher */}
            {mode !== 'forgot' && (
              <div className="grid grid-cols-2 gap-1 bg-slate-100 dark:bg-[#111315] p-1 rounded-md mb-5 border border-slate-200 dark:border-[#30363B]/60">
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(null); }}
                  className={`py-1.5 text-xs rounded transition-colors ${
                    mode === 'login'
                      ? 'bg-white dark:bg-[#202428] text-slate-900 dark:text-[#F2F1ED] font-semibold shadow-sm'
                      : 'text-slate-500 dark:text-[#747C84] hover:text-slate-900 dark:hover:text-[#F2F1ED]'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('register'); setError(null); }}
                  className={`py-1.5 text-xs rounded transition-colors ${
                    mode === 'register'
                      ? 'bg-white dark:bg-[#202428] text-slate-900 dark:text-[#F2F1ED] font-semibold shadow-sm'
                      : 'text-slate-500 dark:text-[#747C84] hover:text-slate-900 dark:hover:text-[#F2F1ED]'
                  }`}
                >
                  Register
                </button>
              </div>
            )}

            {/* Error & Success States */}
            {error && (
              <div className="mb-4 p-2.5 rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 text-xs">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="mb-4 p-2.5 rounded-md bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400 text-xs flex items-start gap-2">
                <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-900 dark:text-[#F2F1ED] mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-[#747C84]">
                    <Mail size={14} />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full pl-9 pr-3.5 py-2 rounded-lg border border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#111315] text-xs text-slate-900 dark:text-[#F2F1ED] placeholder:text-slate-400 dark:placeholder:text-[#747C84] focus:outline-none focus:border-[#C58A52] transition-colors"
                  />
                </div>
              </div>

              {mode !== 'forgot' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-900 dark:text-[#F2F1ED]">
                      Password
                    </label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => { setMode('forgot'); setError(null); }}
                        className="text-[11px] text-[#C58A52] hover:underline"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-[#747C84]">
                      <Lock size={14} />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-10 py-2 rounded-lg border border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#111315] text-xs text-slate-900 dark:text-[#F2F1ED] placeholder:text-slate-400 dark:placeholder:text-[#747C84] focus:outline-none focus:border-[#C58A52] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-[#F2F1ED]"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-[#C58A52] hover:bg-[#D99B62] disabled:opacity-50 text-[#111315] font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <span>
                    {mode === 'login' ? 'Authenticate & Enter' : mode === 'register' ? 'Register Account' : 'Send Reset Link'}
                  </span>
                )}
              </button>

              {mode === 'forgot' && (
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(null); }}
                  className="w-full text-center text-xs text-slate-500 hover:text-slate-900 dark:hover:text-[#F2F1ED] pt-1"
                >
                  Back to Sign In
                </button>
              )}
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LoginModal;
