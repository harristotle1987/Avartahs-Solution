
import React from 'react';
import { motion } from 'framer-motion';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hoverGlow?: 'blue' | 'orange' | 'none';
  animateOnHover?: boolean;
}

const GlassCard: React.FC<GlassCardProps> = ({ 
  children, 
  className = '', 
  hoverGlow = 'none',
  animateOnHover = true
}) => {
  const glowClasses = {
    blue: 'hover:shadow-[0_0_30px_-5px_rgba(59,130,246,0.3)] hover:border-electric/30',
    orange: 'hover:shadow-[0_0_30px_-5px_rgba(249,115,22,0.3)] hover:border-sunset/30',
    none: ''
  };

  return (
    <motion.div
      whileHover={animateOnHover ? { y: -5, scale: 1.01 } : {}}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`
        glass-effect 
        rounded-3xl 
        p-6 
        transition-all 
        duration-500 
        ${glowClasses[hoverGlow]} 
        ${className}
      `}
    >
      {children}
    </motion.div>
  );
};

export default GlassCard;
