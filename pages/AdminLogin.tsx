
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, ArrowRight, ShieldAlert } from 'lucide-react';
import { login, isAuthenticated } from '../lib/auth';

const AdminLogin: React.FC = () => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated()) {
      navigate('/admin/dashboard');
    }
  }, [navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(password)) {
      navigate('/admin/dashboard');
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-midnight">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="flex justify-center mb-12">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-electric to-sunset rounded-2xl flex items-center justify-center font-black text-white text-2xl shadow-xl shadow-electric/20">A</div>
            <span className="text-2xl font-black tracking-tighter text-white">AVARTAH ADMIN</span>
          </div>
        </div>

        <div className="glass-effect p-10 rounded-[2.5rem] border-white/5 glow-blue">
          <h1 className="text-2xl font-black mb-2 text-white">Access Portal</h1>
          <p className="text-muted mb-8 font-medium">Enter your credentials to manage lead data.</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted uppercase tracking-widest ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-midnight/50 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white focus:border-electric outline-none transition-all"
                />
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 text-red-400 text-sm font-bold bg-red-400/10 p-3 rounded-xl border border-red-400/20"
              >
                <ShieldAlert size={16} />
                Invalid administrator password
              </motion.div>
            )}

            <button 
              type="submit"
              className="w-full flex items-center justify-center gap-2 px-8 py-4 bg-electric hover:bg-electric/90 text-white rounded-2xl font-black text-lg transition-all transform hover:scale-[1.02] active:scale-95 glow-blue shadow-xl shadow-electric/20"
            >
              Enter Dashboard <ArrowRight size={20} />
            </button>
          </form>
        </div>

        <p className="text-center mt-8 text-muted/40 text-xs font-bold tracking-[0.2em] uppercase">
          SECURE 256-BIT ENCRYPTED SESSION
        </p>
      </motion.div>
    </div>
  );
};

export default AdminLogin;
