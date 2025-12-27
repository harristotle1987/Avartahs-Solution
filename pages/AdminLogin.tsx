
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, ArrowRight, ShieldAlert, Loader2, Terminal } from 'lucide-react';
import { login, isAuthenticated } from '../lib/auth';

const AdminLogin: React.FC = () => {
  const [password, setPassword] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState(false);
  const [authStep, setAuthStep] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated()) {
      navigate('/admin/dashboard');
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    setError(false);

    // Simulate forensic security handshake
    const steps = [
      "ESTABLISHING_SECURE_NODE",
      "DECRYPTING_CREDENTIALS",
      "VALIDATING_ADMIN_ID",
      "HANDSHAKE_COMPLETE"
    ];

    for (const step of steps) {
      setAuthStep(step);
      await new Promise(r => setTimeout(r, 400));
    }

    if (login(password)) {
      navigate('/admin/dashboard');
    } else {
      setError(true);
      setIsVerifying(false);
      setAuthStep('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 relative overflow-hidden font-mono">
      <div className="absolute inset-0 cyber-grid opacity-10 pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="flex justify-center mb-12">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center font-black text-slate-950 text-2xl shadow-2xl">A</div>
            <span className="text-2xl font-black tracking-tighter text-white uppercase">AVARTAH ADMIN</span>
          </div>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl p-10 rounded-[2.5rem] border border-white/5 shadow-2xl">
          <div className="flex items-center gap-2 mb-6">
            <Terminal size={14} className="text-electric" />
            <h1 className="text-lg font-black text-white uppercase tracking-widest">Access Portal</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Secure Credential</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input 
                  autoFocus
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={isVerifying}
                  className="w-full bg-slate-950 border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-white focus:border-sunset outline-none transition-all placeholder:text-slate-800 disabled:opacity-50"
                />
              </div>
            </div>

            <AnimatePresence>
              {isVerifying && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] font-black text-electric animate-pulse tracking-widest">{authStep}</span>
                    <Loader2 size={12} className="animate-spin text-electric" />
                  </div>
                  <div className="h-1 w-full bg-slate-950 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-electric"
                      initial={{ width: '0%' }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 1.6 }}
                    />
                  </div>
                </motion.div>
              )}

              {error && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-3 text-red-500 text-[10px] font-black bg-red-500/10 p-4 rounded-xl border border-red-500/20 uppercase tracking-widest"
                >
                  <ShieldAlert size={16} />
                  Authentication Logic Fault
                </motion.div>
              )}
            </AnimatePresence>

            <button 
              type="submit"
              disabled={isVerifying || !password}
              className="w-full flex items-center justify-center gap-3 px-8 py-5 bg-white text-slate-950 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-20 shadow-xl"
            >
              {isVerifying ? 'Verifying...' : (
                <>INITIATE SESSION <ArrowRight size={16} /></>
              )}
            </button>
          </form>
        </div>

        <p className="text-center mt-12 text-slate-600 text-[8px] font-black tracking-[0.4em] uppercase">
          SECURE 256-BIT ENCRYPTED INTERFACE
        </p>
      </motion.div>
    </div>
  );
};

export default AdminLogin;
