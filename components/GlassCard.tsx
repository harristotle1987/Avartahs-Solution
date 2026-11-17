import React from 'react';
import { motion } from 'framer-motion';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  animateOnHover?: boolean;
  glowOnHover?: boolean;
  onClick?: () => void;
}

const GlassCard: React.FC<GlassCardProps> = ({ 
  children, 
  className = '', 
  animateOnHover = true,
  glowOnHover = true,
  onClick
}) => {
  return (
    <motion.div
      onClick={onClick}
      whileHover={animateOnHover ? { y: -4 } : undefined}
      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      className={`
        relative overflow-hidden
        bg-white/70 dark:bg-[#171A1D]/75
        backdrop-blur-xl backdrop-saturate-150
        border border-slate-200/80 dark:border-white/10
        rounded-xl
        p-6
        transition-all duration-300
        ${glowOnHover ? 'hover:border-[#C58A52]/60 hover:shadow-[0_12px_36px_rgba(197,138,82,0.15)]' : ''}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
    >
      {/* Refraction top sheen highlight */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 dark:via-white/20 to-transparent pointer-events-none" />
      
      {/* Background radial glow effect */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#C58A52]/5 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10">
        {children}
      </div>
    </motion.div>
  );
};

export default GlassCard;

