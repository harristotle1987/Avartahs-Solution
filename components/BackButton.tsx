import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Home } from 'lucide-react';

interface BackButtonProps {
  fallbackPath?: string;
  className?: string;
  label?: string;
}

export const BackButton: React.FC<BackButtonProps> = ({
  fallbackPath = '/',
  className = '',
  label = 'Back'
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate(fallbackPath);
    }
  };

  return (
    <div className={`flex items-center gap-2.5 z-50 ${className}`}>
      <button
        onClick={handleBack}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-black/40 hover:bg-black/60 border border-white/15 text-white/90 hover:text-white text-xs font-black uppercase tracking-widest transition-all shadow-lg cursor-pointer backdrop-blur-xl group"
        title="Go back to previous page"
      >
        <ArrowLeft className="w-4 h-4 text-[#C58A52] group-hover:-translate-x-0.5 transition-transform" />
        <span>{label}</span>
      </button>
      {location.pathname !== '/' && (
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/40 hover:bg-black/60 border border-white/15 text-white/70 hover:text-white text-xs font-black uppercase tracking-widest transition-all shadow-lg cursor-pointer backdrop-blur-xl"
          title="Return to Home"
        >
          <Home className="w-3.5 h-3.5 text-[#C58A52]" />
          <span className="hidden sm:inline">Home</span>
        </button>
      )}
    </div>
  );
};
